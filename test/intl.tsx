import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import type { Locale } from "@/i18n/routing";
import en from "@/messages/en.json";
import it from "@/messages/it.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import pt from "@/messages/pt.json";

const MESSAGES = { en, it, es, fr, de, pt };

/** Render inside the intl provider of `locale` (English by default). */
function renderIntl(ui: ReactElement, { locale = "en", ...options }: RenderOptions & { locale?: Locale } = {}) {
  return render(<NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>{ui}</NextIntlClientProvider>, options);
}

export * from "@testing-library/react";
export { renderIntl as render };
