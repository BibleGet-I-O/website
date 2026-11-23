import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

const { default: CopyrightPage } = await import("@/app/[locale]/copyright/page");

async function page() {
  const ui = await CopyrightPage({ params: Promise.resolve({ locale: "en" }) });
  return render(<NextIntlClientProvider locale="en" messages={en}>{ui}</NextIntlClientProvider>);
}

describe("copyright page", () => {
  it("saysWhoseProjectBibleGetIs", async () => {
    await page();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Copyright and permissions");
    expect(screen.getByText(/BibleGet is a project of the Catholic Digital Commons Foundation/)).toBeInTheDocument();
  });

  it("hasASectionForEachEditionUnderPermissionLinkableByItsSigla", async () => {
    const { container } = await page();
    expect(Array.from(container.querySelectorAll("section[id]")).map((s) => s.id)).toEqual(["nabre", "cei2008", "blpd", "nvbse"]);
  });

  it("quotesTheNabreNoticeAndImprimaturAsTheLicenceStatesThem", async () => {
    const { container } = await page();
    const nabre = container.querySelector("#nabre")!;
    expect(nabre).toHaveTextContent("Confraternity of Christian Doctrine, Inc.");
    const notice = nabre.querySelector("blockquote")!;
    expect(notice).toHaveAttribute("lang", "en");
    expect(notice).toHaveTextContent(
      "Scripture texts used in this work are taken from the New American Bible, revised edition © 2010, 1991, 1986, 1970 Confraternity of Christian Doctrine, Inc., Washington, DC All Rights Reserved. No part of this work may be reproduced or transmitted in any form or by any means, electronic or mechanical, including photocopying, recording, or by any information storage and retrieval system, without permission in writing from the copyright owner.",
    );
    expect(nabre).toHaveTextContent("Stephen J. Hartdegen, O.F.M., L.S.S.");
    expect(nabre).toHaveTextContent("+James A. Hickey, S.T.D., J.C.D.");
    expect(nabre).toHaveTextContent("In accord with canon 825 §1 of the Code of Canon Law");
    expect(nabre).toHaveTextContent("Francis Cardinal George, O.M.I.");
  });

  it("quotesTheBlpdNoticeInSpanishAsTheAgreementStatesIt", async () => {
    const { container } = await page();
    const notice = container.querySelector("#blpd blockquote")!;
    expect(notice).toHaveAttribute("lang", "es");
    expect(notice).toHaveTextContent("“La Biblia. Libro del Pueblo de Dios”, edición revisada 2015 © Fundación Palabra de Vida y Editorial Verbo Divino. Todos los derechos reservados.");
  });

  it("creditsCei2008AndTheNovaVulgataToTheirHolders", async () => {
    const { container } = await page();
    expect(container.querySelector("#cei2008 blockquote")).toHaveAttribute("lang", "it");
    expect(container.querySelector("#cei2008")).toHaveTextContent("Fondazione di Religione “Santi Francesco d’Assisi e Caterina da Siena”");
    expect(container.querySelector("#nvbse")).toHaveTextContent("Libreria Editrice Vaticana");
  });
});
