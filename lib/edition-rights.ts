/**
 * The editions BibleGet quotes by permission of their rights holders, with the notice each permission asks for.
 * Notices are quoted as the agreements state them, in their own language: never translate or reword them.
 *
 * - NABRE: License Agreement with the Confraternity of Christian Doctrine, Inc., 2015 (§6 notice, §7 imprimatur).
 * - BLPD: "Acuerdo de cesión de derechos", Buenos Aires, 28 October 2020.
 * - CEI2008: permission given by the rights holder; there is no written agreement, so the notice is the usual
 *   credit line for the edition.
 * - NVBSE: the Libreria Editrice Vaticana's edition, as published on the Holy See's website.
 */
export type EditionRights = {
  /** The section's anchor: /{locale}/copyright#{id}. */
  id: "nabre" | "cei2008" | "blpd" | "nvbse";
  sigla: string;
  title: string;
  holder: string;
  /** The notice's language (BCP 47), for its lang attribute. */
  lang: string;
  notice: string;
  /** Extra notices the permission requires (NABRE: its imprimatur), each a block of lines. */
  approvals?: { heading: string; lines: string[] }[];
  source?: string;
};

export const EDITION_RIGHTS: readonly EditionRights[] = [
  {
    id: "nabre",
    sigla: "NABRE",
    title: "New American Bible, revised edition",
    holder: "Confraternity of Christian Doctrine, Inc.",
    lang: "en",
    notice:
      "Scripture texts used in this work are taken from the New American Bible, revised edition © 2010, 1991, 1986, 1970 Confraternity of Christian Doctrine, Inc., Washington, DC All Rights Reserved. No part of this work may be reproduced or transmitted in any form or by any means, electronic or mechanical, including photocopying, recording, or by any information storage and retrieval system, without permission in writing from the copyright owner.",
    approvals: [
      {
        heading: "New Testament",
        lines: [
          "Nihil Obstat: Stephen J. Hartdegen, O.F.M., L.S.S., Censor Deputatus",
          "Imprimatur: +James A. Hickey, S.T.D., J.C.D., Archbishop of Washington, August 27, 1986",
        ],
      },
      {
        heading: "Old Testament: Rescript",
        lines: [
          "In accord with canon 825 §1 of the Code of Canon Law, the United States Conference of Catholic Bishops hereby approves for publication The New American Bible, Revised Old Testament, a translation of the Sacred Scriptures authorized by the Confraternity of Christian Doctrine, Inc.",
          "The translation was approved by the Administrative Committee of the United States Conference of Catholic Bishops in November 2008 and September 2010. It is permitted by the undersigned for private use and study.",
          "Given in the city of Washington, the District of Columbia, on the Feast of Saint Jerome, Priest and Doctor of the Church, the 30th day of September, in the year of our Lord 2010.",
          "Francis Cardinal George, O.M.I., Archbishop of Chicago, President, USCCB",
        ],
      },
    ],
  },
  {
    id: "cei2008",
    sigla: "CEI2008",
    title: "La Sacra Bibbia (CEI 2008)",
    holder: "Fondazione di Religione “Santi Francesco d’Assisi e Caterina da Siena”",
    lang: "it",
    notice: "Testi biblici tratti da La Sacra Bibbia © 2008 Fondazione di Religione “Santi Francesco d’Assisi e Caterina da Siena”.",
  },
  {
    id: "blpd",
    sigla: "BLPD",
    title: "La Biblia. Libro del Pueblo de Dios",
    holder: "Fundación Palabra de Vida y Editorial Verbo Divino",
    lang: "es",
    notice: "“La Biblia. Libro del Pueblo de Dios”, edición revisada 2015 © Fundación Palabra de Vida y Editorial Verbo Divino. Todos los derechos reservados.",
  },
  {
    id: "nvbse",
    sigla: "NVBSE",
    title: "Nova Vulgata - Bibliorum Sacrorum Editio",
    holder: "Libreria Editrice Vaticana",
    lang: "la",
    notice: "Nova Vulgata Bibliorum Sacrorum Editio © Libreria Editrice Vaticana.",
    source: "https://www.vatican.va/archive/bible/nova_vulgata/documents/nova-vulgata_index_lt.html",
  },
];
