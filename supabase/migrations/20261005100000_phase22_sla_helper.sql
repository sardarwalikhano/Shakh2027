create or replace function private.get_delivery_sla(p_order_created_at timestamptz,p_status text,p_assigned_at timestamptz,p_accepted_at timestamptz,p_picked_up_at timestamptz,p_estimated_minutes integer)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare v_deadline timestamptz; v_anchor timestamptz; v_age integer:=greatest(0,floor(extract(epoch from(clock_timestamp()-p_order_created_at))/60)::integer); v_remaining integer; v_state text:='not_available'; v_next text:='monitor';
begin
 if p_status is null or p_status in ('unassigned','failed','cancelled') then v_deadline:=p_order_created_at+interval '10 minutes'; v_next:='assign_captain';
 elsif p_status='assigned' then v_anchor:=coalesce(p_assigned_at,p_order_created_at); v_deadline:=v_anchor+interval '3 minutes'; v_next:='await_captain_acceptance';
 elsif p_status in ('accepted','at_pickup') then v_anchor:=coalesce(p_accepted_at,p_assigned_at,p_order_created_at); v_deadline:=v_anchor+interval '20 minutes'; v_next:=case when p_status='accepted' then 'arrive_pickup' else 'confirm_pickup' end;
 elsif p_status in ('picked_up','out_for_delivery') and p_estimated_minutes is not null then v_anchor:=coalesce(p_picked_up_at,p_accepted_at,p_assigned_at,p_order_created_at); v_deadline:=v_anchor+make_interval(mins=>greatest(p_estimated_minutes,0)); v_next:='deliver_order';
 elsif p_status in ('picked_up','out_for_delivery') then v_next:='eta_unavailable';
 elsif p_status='delivered' then v_next:='completed';
 end if;
 if v_deadline is not null then v_remaining:=ceil(extract(epoch from(v_deadline-clock_timestamp()))/60)::integer; v_state:=case when v_remaining<0 then 'overdue' when v_remaining<=5 then 'at_risk' else 'on_track' end; end if;
 return jsonb_build_object('sla_state',v_state,'deadline',v_deadline,'remaining_minutes',v_remaining,'age_minutes',v_age,'next_action',v_next);
end; $$;
revoke all on function private.get_delivery_sla(timestamptz,text,timestamptz,timestamptz,timestamptz,integer) from public,anon,authenticated;
