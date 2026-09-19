/**
 * The look of every email we send a customer — the website's palette and
 * typography, rebuilt for mail clients.
 *
 * Email rendering is twenty years behind the browser, so this is deliberately
 * old-fashioned: nested tables, inline styles on every element, no flexbox, no
 * grid, no external stylesheet. Gmail strips <style> blocks and web fonts, so
 * Playfair Display and DM Sans are requested for the clients that honour them
 * (Apple Mail) and fall back to Georgia and Helvetica everywhere else — both
 * close enough in feel to keep the emails recognisably ours.
 *
 * Team emails stay plain text on purpose; they're worked from, not read.
 */

const PALETTE = {
  page: "#F2EBE0",
  card: "#FAF8F3",
  panel: "#EDE5D8",
  ink: "#2A2825",
  body: "#57524A",
  muted: "#7A7468",
  accent: "#C4785A",
  line: "rgba(42,40,37,0.10)"
};

const DISPLAY_FONT = "'Playfair Display', Georgia, 'Times New Roman', serif";
const BODY_FONT = "'DM Sans', -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif";

const LOGO_URL = "https://dharma-space.com/dharma-logo-mark.png";
const SITE_URL = "https://dharma-space.com";
const STUDIO_ADDRESS_LINE = "13 Upper Circular Road #03-01, Singapore 058411";

export type EmailDetail = { label: string; value: string };

export type CustomerEmailOptions = {
  /** Small caps line above the heading, e.g. "Booking confirmed". */
  eyebrow: string;
  heading: string;
  /** The grey preview line in the inbox, before the body is opened. */
  preheader?: string;
  greeting?: string;
  /** Body copy above the detail panel. */
  paragraphs?: string[];
  details?: EmailDetail[];
  detailsTitle?: string;
  /** A single number worth making large — credits bought, sessions left. */
  highlight?: { value: string; label: string };
  /** Secondary panel under the details, e.g. what credits cover. */
  note?: { title?: string; lines: string[] };
  cta?: { label: string; url: string };
  /** Body copy below the panels, e.g. terms and reassurance. */
  closing?: string[];
  signOff?: string;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

/**
 * Rewrites machine dates inside a label — "Thursday, 2026-10-01" becomes
 * "Thursday, 1 October 2026". Schedules are stored ISO; customers shouldn't
 * have to read them that way.
 */
export function humaniseDates(value: string): string {
  return value.replace(
    /(\d{4})-(\d{2})-(\d{2})/g,
    (_match, year, month, day) => `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`
  );
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turns bare URLs and email addresses in body copy into links. */
function linkify(value: string): string {
  return escapeHtml(value)
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      `<a href="$1" style="color:${PALETTE.accent};text-decoration:underline;">$1</a>`
    )
    .replace(
      /([\w.+-]+@[\w-]+\.[\w.]+)/g,
      `<a href="mailto:$1" style="color:${PALETTE.accent};text-decoration:underline;">$1</a>`
    );
}

function paragraph(text: string, color = PALETTE.body): string {
  return `<p style="margin:0 0 16px;font-family:${BODY_FONT};font-size:15px;line-height:1.75;color:${color};">${linkify(
    text
  )}</p>`;
}

function detailRows(details: EmailDetail[]): string {
  return details
    .map(
      (row, index) => `
      <tr>
        <td style="padding:${index === 0 ? "0" : "12px"} 0 0;font-family:${BODY_FONT};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${PALETTE.accent};" valign="top" width="38%">${escapeHtml(
        row.label
      )}</td>
        <td style="padding:${index === 0 ? "0" : "12px"} 0 0;font-family:${BODY_FONT};font-size:14px;line-height:1.5;color:${PALETTE.ink};" valign="top">${escapeHtml(
          row.value
        ).replace(/\n/g, "<br />")}</td>
      </tr>`
    )
    .join("");
}

export function renderCustomerEmail(options: CustomerEmailOptions): string {
  const {
    eyebrow,
    heading,
    preheader,
    greeting,
    paragraphs = [],
    details = [],
    detailsTitle,
    highlight,
    note,
    cta,
    closing = [],
    signOff = "Warm regards,\nDharma Space Team"
  } = options;

  const whatsapp = process.env.WHATSAPP_URL || "https://wa.me/6598664331";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(heading)}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
<style>
  /* Honoured by clients that keep <style>; everything critical is inline. */
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a { text-decoration:none; }
  @media only screen and (max-width:620px) {
    .ds-card { padding:32px 24px !important; }
    .ds-heading { font-size:26px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${PALETTE.page};">
  <div style="display:none;font-size:1px;color:${PALETTE.page};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(
    preheader || heading
  )}</div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${PALETTE.page};">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">

          <!-- Wordmark -->
          <tr>
            <td align="center" style="padding:0 0 28px;">
              <a href="${SITE_URL}" style="text-decoration:none;">
                <img src="${LOGO_URL}" width="44" height="44" alt="" style="display:block;margin:0 auto 10px;width:44px;height:44px;" />
                <span style="font-family:${BODY_FONT};font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:${PALETTE.muted};">Dharma Space</span>
              </a>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="ds-card" style="background-color:${PALETTE.card};padding:44px 48px;border:1px solid ${PALETTE.line};">

              <p style="margin:0 0 14px;font-family:${BODY_FONT};font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:${PALETTE.accent};">${escapeHtml(
                eyebrow
              )}</p>

              <h1 class="ds-heading" style="margin:0 0 26px;font-family:${DISPLAY_FONT};font-size:30px;line-height:1.2;font-weight:400;color:${PALETTE.ink};">${escapeHtml(
                heading
              )}</h1>

              ${greeting ? paragraph(greeting, PALETTE.ink) : ""}
              ${paragraphs.map((p) => paragraph(p)).join("")}

              ${
                highlight
                  ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 26px;">
                <tr>
                  <td align="center" style="background-color:${PALETTE.panel};padding:28px 20px;">
                    <div style="font-family:${DISPLAY_FONT};font-size:40px;line-height:1;color:${PALETTE.ink};">${escapeHtml(
                      highlight.value
                    )}</div>
                    <div style="margin-top:10px;font-family:${BODY_FONT};font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${PALETTE.accent};">${escapeHtml(
                      highlight.label
                    )}</div>
                  </td>
                </tr>
              </table>`
                  : ""
              }

              ${
                details.length
                  ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 26px;">
                <tr>
                  <td style="background-color:${PALETTE.panel};padding:26px 28px;">
                    ${
                      detailsTitle
                        ? `<p style="margin:0 0 18px;font-family:${BODY_FONT};font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${PALETTE.muted};">${escapeHtml(
                            detailsTitle
                          )}</p>`
                        : ""
                    }
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      ${detailRows(details)}
                    </table>
                  </td>
                </tr>
              </table>`
                  : ""
              }

              ${
                note
                  ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 26px;">
                <tr>
                  <td style="padding:20px 24px;border-left:2px solid ${PALETTE.accent};background-color:rgba(196,120,90,0.05);">
                    ${
                      note.title
                        ? `<p style="margin:0 0 10px;font-family:${BODY_FONT};font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${PALETTE.accent};">${escapeHtml(
                            note.title
                          )}</p>`
                        : ""
                    }
                    ${note.lines
                      .map(
                        (line) =>
                          `<p style="margin:0 0 6px;font-family:${BODY_FONT};font-size:13px;line-height:1.65;color:${PALETTE.body};">${linkify(
                            line
                          )}</p>`
                      )
                      .join("")}
                  </td>
                </tr>
              </table>`
                  : ""
              }

              ${
                cta
                  ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td align="center" bgcolor="${PALETTE.accent}" style="background-color:${PALETTE.accent};">
                    <a href="${cta.url}" style="display:inline-block;padding:15px 34px;font-family:${BODY_FONT};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#ffffff;text-decoration:none;">${escapeHtml(
                      cta.label
                    )}</a>
                  </td>
                </tr>
              </table>`
                  : ""
              }

              ${closing.map((p) => paragraph(p, PALETTE.muted)).join("")}

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:8px;">
                <tr><td style="border-top:1px solid ${PALETTE.line};padding-top:22px;">
                  <p style="margin:0;font-family:${BODY_FONT};font-size:14px;line-height:1.7;color:${PALETTE.ink};">${signOff
    .split("\n")
    .map((line) => escapeHtml(line))
    .join("<br />")}</p>
                </td></tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 24px 8px;">
              <p style="margin:0 0 10px;font-family:${BODY_FONT};font-size:12px;line-height:1.7;color:${PALETTE.muted};">
                ${escapeHtml(STUDIO_ADDRESS_LINE)}
              </p>
              <p style="margin:0 0 14px;font-family:${BODY_FONT};font-size:12px;color:${PALETTE.muted};">
                <a href="${SITE_URL}" style="color:${PALETTE.accent};text-decoration:none;">dharma-space.com</a>
                &nbsp;·&nbsp;
                <a href="${whatsapp}" style="color:${PALETTE.accent};text-decoration:none;">WhatsApp</a>
              </p>
              <p style="margin:0;font-family:${BODY_FONT};font-size:11px;line-height:1.6;color:${PALETTE.muted};opacity:0.8;">
                You're receiving this because you booked or bought something at Dharma Space.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
