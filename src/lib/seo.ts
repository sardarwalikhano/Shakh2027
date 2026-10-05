export function setPageSeo(input: { title: string; description?: string; canonicalPath?: string }) {
  document.title = input.title;
  const description = input.description ?? '';
  let descriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!descriptionMeta) {
    descriptionMeta = document.createElement('meta');
    descriptionMeta.name = 'description';
    document.head.appendChild(descriptionMeta);
  }
  descriptionMeta.content = description;

  const canonical = input.canonicalPath ? new URL(input.canonicalPath, window.location.origin).toString() : undefined;
  let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) {
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonical;
  } else if (canonicalLink) {
    canonicalLink.remove();
  }
}
