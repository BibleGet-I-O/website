import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentType, ReactElement, ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import en from "@/messages/en.json";
import it from "@/messages/it.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import pt from "@/messages/pt.json";

const MESSAGES = { en, it, es, fr, de, pt };

/**
 * Render inside the intl provider of `locale` (English by default). The provider is a wrapper, composed with any the
 * caller gives, so it stays in place when the test calls `rerender`.
 */
function renderIntl(ui: ReactElement, { locale = "en", wrapper: Inner, ...options }: RenderOptions & { locale?: Locale } = {}) {
  const Wrapper = ({ children }: { children: ReactNode }) => {
    const content = Inner ? <Inner>{children}</Inner> : children;
    return <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>{content}</NextIntlClientProvider>;
  };
  return render(ui, { ...options, wrapper: Wrapper as ComponentType<{ children: ReactNode }> });
}

export * from "@testing-library/react";
export { renderIntl as render };
