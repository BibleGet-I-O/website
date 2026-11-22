import { Fragment } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { getApiVersion } from "@/lib/api";
import { COMMIT, RELEASE } from "@/lib/release";
import { ENDPOINT_REPO, WEBSITE_REPO, apiVersionLink, siteVersionLink, type VersionLink } from "@/lib/versions";

const LINK = "underline hover:text-slate-900 dark:hover:text-slate-100";

function Version({ link, children }: { link: VersionLink; children: string }) {
  return link.href ? (
    <a href={link.href} className={LINK}>
      {children}
    </a>
  ) : (
    <>{children}</>
  );
}

/** The site footer: the foundation's copyright, the endpoint's version and the site's own (each linked to GitHub), and the source repositories. */
export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const locale = await getLocale();
  const apiVersion = await getApiVersion();
  const api = apiVersion ? apiVersionLink(apiVersion) : null;
  const site = siteVersionLink(COMMIT, RELEASE);
  const repos = [
    { key: "website", href: WEBSITE_REPO },
    { key: "api", href: ENDPOINT_REPO },
  ] as const;
  return (
    <footer className="mt-auto border-t border-slate-200 px-4 py-3 text-center text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
      <p className="text-xs">
        {t.rich("copyright", {
          year: new Date().getFullYear(),
          link: (chunks) => (
            <a href="https://catholicdigitalcommons.org" className={LINK}>
              {chunks}
            </a>
          ),
        })}
      </p>
      {/* The editions' texts carry their own rights: the copyright page quotes each permission's notice. */}
      <p className="text-xs">
        {t.rich("rights", {
          link: (chunks) => (
            <a href={`/${locale}/copyright`} className={LINK}>
              {chunks}
            </a>
          ),
        })}
      </p>
      <p className="text-xs">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor" className="mr-1 inline-block align-[-2px]">
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
        </svg>
        {t("sourceCode")}{" "}
        {repos.map(({ key, href }, i) => (
          <Fragment key={key}>
            {i > 0 && " · "}
            <a href={href} className={LINK}>
              {t(`repos.${key}`)}
            </a>
          </Fragment>
        ))}
      </p>
      <p className="text-xs">
        {api && (
          <>
            <Version link={api}>{t("apiVersion", { version: api.label })}</Version>
            {" · "}
          </>
        )}
        <Version link={site}>{t("siteVersion", { version: site.label })}</Version>
      </p>
    </footer>
  );
}
