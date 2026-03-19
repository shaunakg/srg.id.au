export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function isExternalHref(href: string) {
  return /^[a-z][a-z\d+.-]*:/i.test(href);
}
