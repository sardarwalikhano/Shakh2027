import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/shell/AppShell";
import CartPanel from "./components/CartPanel";
import AddressStep from "./components/AddressStep";
import DeliveryStep from "./components/DeliveryStep";
import PaymentStep from "./components/PaymentStep";
import CheckoutSummary from "./components/CheckoutSummary";
import ShoppingStepper from "./components/ShoppingStepper";
import { EMPTY_ADDRESS, type AddressDraft, type DeliveryOption, type PaymentMethod, type ShoppingStep } from "./models";
import { getMyCart } from "../commerce/cartApi";
import { supabase } from "../../lib/supabase";
import { getMyAddresses, saveAddress, placeOrderFromCart, type PlaceOrderResult } from "../commerce/orderApi";
import { validateCoupon, type CouponValidation } from "../commerce/promotionsApi";
import { recordAnalyticsEvent } from "../commerce/analyticsApi";
import { subscribeToPaymentIntents, type PaymentInitialization } from "../commerce/paymentApi";
import { useAuth } from "../auth/AuthContext";
import { getCartDeliveryQuote, type DeliveryQuote } from "../commerce/deliveryPricingApi";

const stepOrder: ShoppingStep[] = ["cart", "address", "delivery", "payment", "review"];

export default function ShoppingFlowPage() {
  const [step, setStep] = useState<ShoppingStep>("cart");
  const [address, setAddress] = useState<AddressDraft>(EMPTY_ADDRESS);
  const [addressId, setAddressId] = useState("");
  const [deliveryId, setDeliveryId] = useState("standard");
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const [loadingDeliveryQuote, setLoadingDeliveryQuote] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod | null>("cash_on_delivery");
  const [cartItems, setCartItems] = useState<Awaited<ReturnType<typeof getMyCart>>>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<PlaceOrderResult | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentInitialization | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponValidation, setCouponValidation] = useState<CouponValidation | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [analyticsSessionId] = useState(() => crypto.randomUUID());
  const { user, profile } = useAuth();
  const [checkoutIdempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const [cart, addresses] = await Promise.all([getMyCart(), getMyAddresses()]);
        if (cancelled) return;
        setCartItems(cart);
        const defaultAddress = addresses[0];
        if (defaultAddress) {
          setAddressId(defaultAddress.id as string);
          setAddress({
            recipientName: defaultAddress.recipient_name ?? "",
            phone: defaultAddress.phone ?? "",
            city: defaultAddress.city ?? "هەولێر",
            district: defaultAddress.district ?? "",
            street: defaultAddress.street ?? "",
            landmark: defaultAddress.landmark ?? "",
            notes: defaultAddress.notes ?? "",
          });
        }
      } catch (error: unknown) {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : "نەتوانرا سەبەتە باربکرێت.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();
    return () => { cancelled = true; };
  }, []);

  const delivery = useMemo(() => deliveryOptions.find((item) => item.id === deliveryId) ?? null, [deliveryId, deliveryOptions]);
  const index = stepOrder.indexOf(step);

  const next = () => setStep(stepOrder[Math.min(index + 1, stepOrder.length - 1)]);
  const back = () => setStep(stepOrder[Math.max(index - 1, 0)]);

  const loadDeliveryQuote = async (id: string) => {
    if (!id) return false;
    setLoadingDeliveryQuote(true);
    setErrorMessage(null);
    try {
      const quote = await getCartDeliveryQuote(id);
      setDeliveryQuote(quote);
      const firstEta = quote.quotes.map((item) => item.estimated_minutes).filter((value): value is number => value != null)[0] ?? null;
      if (!quote.serviceable) {
        setErrorMessage("ئەم ناونیشانە لە Delivery Zone ـە چالاکەکاندا نییە؛ تکایە ناونیشانێکی تر هەڵبژێرە.");
      }
      setDeliveryOptions([{
        id: "standard",
        title: quote.serviceable ? "گەیاندنی ستاندارد" : "گەیاندن بۆ ئەم ناوچەیە بەردەست نییە",
        description: !quote.configured
          ? "Delivery Zone ـەکان هێشتا configuration ـیان نەکراوە؛ نرخی بنەڕەتی ٠ د.ع لە کاتی order ـدا بەردەستە."
          : quote.serviceable
            ? `${quote.quotes.length} vendor · نرخ لە server ـەوە حیساب کراوە${quote.quotes[0]?.zone_name_ckb ? ` · ${quote.quotes[0].zone_name_ckb}` : ""}.`
            : "ناونیشانی هەڵبژێردراو لە هیچ Delivery Zone ـێکی چالاکدا نییە.",
        feeIqd: quote.delivery_fee_iqd,
        etaLabel: firstEta != null ? `ETA: نزیکەی ${firstEta} خولەک` : "ETA دوای دیاریکردنی zone ـەوە دەردەکەوێت",
      }]);
      setDeliveryId("standard");
      return quote.serviceable;
    } catch (error: unknown) {
      setDeliveryQuote(null);
      setDeliveryOptions([]);
      setErrorMessage(error instanceof Error ? error.message : "نەتوانرا نرخی گەیاندن حیساب بکرێت.");
      return false;
    } finally {
      setLoadingDeliveryQuote(false);
    }
  };

  const handleAddressChange = (nextAddress: AddressDraft) => {
    setAddress(nextAddress);
    setAddressId("");
    setDeliveryQuote(null);
    setDeliveryOptions([]);
  };

  const handleAddressContinue = async () => {
    setErrorMessage(null);
    if (!address.recipientName || !address.phone || !address.city || !address.district || !address.street) return;
    if (addressId) {
      const serviceable = await loadDeliveryQuote(addressId);
      if (serviceable) next();
      return;
    }

    try {
      const savedId = await saveAddress(address);
      setAddressId(savedId);
      const serviceable = await loadDeliveryQuote(savedId);
      if (serviceable) next();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "نەتوانرا ناونیشان پاشەکەوت بکرێت.");
    }
  };

  const handleValidateCoupon = async (code: string) => {
    const normalized = code.trim();
    if (!normalized) { setCouponValidation(null); return; }
    setValidatingCoupon(true);
    setErrorMessage(null);
    try {
      const result = await validateCoupon(normalized);
      setCouponValidation(result);
      if (!result.valid) setErrorMessage(`Coupon: ${result.reason ?? "invalid_coupon"}`);
    } catch (error: unknown) {
      setCouponValidation(null);
      setErrorMessage(error instanceof Error ? error.message : "نەتوانرا coupon پشتڕاست بکرێتەوە.");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!addressId || !payment) return;
    setPlacing(true);
    setErrorMessage(null);
    try {
      void recordAnalyticsEvent({
        eventName: "checkout_started",
        sessionId: analyticsSessionId,
        properties: { payment_method: payment, has_coupon: Boolean(couponCode.trim()), item_count: cartItems.length },
      }).catch(() => undefined);
      const result = await placeOrderFromCart(addressId, payment, checkoutIdempotencyKey, couponCode.trim() || undefined);
      setOrderResult({
        checkout_session_id: result.checkout_session_id,
        status: result.status,
        order_ids: result.order_ids,
        order_numbers: result.order_numbers,
        total_iqd: result.total_iqd,
      });
      setPaymentResult(result.payment);
      setCartItems([]);
      setCouponValidation(null);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "نەتوانرا payment/order دروست بکرێت.");
    } finally {
      setPlacing(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const channel = subscribeToPaymentIntents(user.id, (intent) => {
      setPaymentResult((current) => current ? { ...current, status: intent.status, payment_intent_id: intent.id } : current);
    });
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return (
    <AppShell>
      <main dir="rtl" className="space-y-6">
        <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[var(--shakh-shadow-sm)] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">SHAKH CHECKOUT</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">لە سەبەتەوە بۆ ئۆردەری پشتڕاستکراو.</h1>
              <p className="mt-3 text-sm leading-7 text-slate-500">نرخ، stock و total ـی کۆتایی لە server ـەوە پشتڕاست دەکرێن؛ client تەنها داواکاریی checkout ناردن دەکات.</p>
            </div>
            {orderResult ? <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">ئۆردەر پشتڕاست کرا</span> : null}
          </div>
          <div className="mt-7 border-t border-slate-100 pt-5">
            <ShoppingStepper current={step} />
          </div>
        </section>

        {errorMessage ? (
          <section role="alert" className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold leading-7 text-rose-800">
            {errorMessage}
          </section>
        ) : null}

        {orderResult ? (
          <section className="overflow-hidden rounded-[30px] border border-emerald-200 bg-white shadow-[var(--shakh-shadow-sm)]">
            <div className="bg-emerald-50 p-7 text-center sm:p-10">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white text-2xl font-black text-emerald-600 shadow-sm">✓</div>
              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">ORDER CONFIRMED</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">ئۆردەرەکەت بە سەرکەوتوویی تۆمار کرا.</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">ژمارەی ئۆردەر: {orderResult.order_numbers.join("، ")}</p>
              <p className="mt-2 text-base font-black text-orange-600">کۆی پشتڕاستکراو: {new Intl.NumberFormat("ku-IQ").format(Number(orderResult.total_iqd))} د.ع</p>
              {paymentResult ? <p className="mt-2 text-xs font-black text-slate-500">Payment: {paymentResult.status}</p> : null}
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <a href="#account/orders" className="shakh-btn-primary">بینینی ئۆردەرەکانم</a>
                <a href="#marketplace" className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 no-underline">گەڕان لە بازار</a>
              </div>
            </div>
          </section>
        ) : null}

        {!orderResult && loading ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">سەبەتە و ناونیشان بار دەکرێن...</section>
        ) : null}

        {!orderResult && !loading && step === "cart" ? (
          <>
            <CartPanel items={cartItems} onItemsChange={setCartItems} />
            <div className="flex justify-end">
              <button type="button" className="shakh-btn-primary" disabled={!cartItems.length} onClick={next}>بەردەوامبوون بۆ ناونیشان</button>
            </div>
          </>
        ) : null}

        {!orderResult && !loading && step === "address" ? (
          <>
            <AddressStep value={address} onChange={handleAddressChange} />
            <div className="flex gap-3">
              <button type="button" className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700" onClick={back}>گەڕانەوە</button>
              <button type="button" className="shakh-btn-primary flex-1" onClick={() => void handleAddressContinue()} disabled={!address.recipientName || !address.phone || !address.city || !address.district || !address.street || loadingDeliveryQuote}>{loadingDeliveryQuote ? "نرخی گەیاندن..." : "بۆ گەیاندن"}</button>
            </div>
          </>
        ) : null}

        {!orderResult && !loading && step === "delivery" ? (
          <>
            <DeliveryStep options={deliveryOptions} selectedId={deliveryId} onSelect={setDeliveryId} />
            <div className="flex gap-3">
              <button type="button" className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700" onClick={back}>گەڕانەوە</button>
              <button type="button" className="shakh-btn-primary flex-1" onClick={next} disabled={!deliveryId || !deliveryQuote?.serviceable}>بۆ پارەدان</button>
            </div>
          </>
        ) : null}

        {!orderResult && !loading && step === "payment" ? (
          <>
            <PaymentStep value={payment} onChange={setPayment} walletBalance={Number(profile?.wallet_balance_iqd ?? 0)} />
            <div className="flex gap-3">
              <button type="button" className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700" onClick={back}>گەڕانەوە</button>
              <button type="button" className="shakh-btn-primary flex-1" onClick={next} disabled={!payment}>بۆ پشکنین</button>
            </div>
          </>
        ) : null}

        {!orderResult && !loading && step === "review" ? (
          <CheckoutSummary
            items={cartItems}
            address={address}
            delivery={delivery}
            payment={payment}
            isSubmitting={placing}
            onBack={back}
            couponCode={couponCode}
            couponValidation={couponValidation}
            validatingCoupon={validatingCoupon}
            onCouponCodeChange={(value) => { setCouponCode(value); setCouponValidation(null); }}
            onValidateCoupon={() => void handleValidateCoupon(couponCode)}
            onContinue={() => void handlePlaceOrder()}
          />
        ) : null}
      </main>
    </AppShell>
  );
}
