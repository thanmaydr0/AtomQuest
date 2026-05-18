export type NotificationFact = { label: string; value: string };

export interface NotificationContent {
  title: string;
  message: string;
  link?: string;
  facts?: NotificationFact[];
}

export function resolveAppLink(appUrl: string, linkPath?: string) {
  if (!linkPath) return appUrl;
  try {
    return new URL(linkPath, appUrl).toString();
  } catch {
    return linkPath;
  }
}

export function buildEmailHtml(content: NotificationContent) {
  const facts = content.facts?.length
    ? `<table style="margin:16px 0;border-collapse:collapse;">${content.facts
        .map(
          (fact) => `
            <tr>
              <td style="padding:6px 12px 6px 0;color:#9ca3af;font-weight:600;vertical-align:top;">${fact.label}</td>
              <td style="padding:6px 0;color:#e5e7eb;">${fact.value}</td>
            </tr>`
        )
        .join('')}</table>`
    : '';

  const linkBlock = content.link
    ? `<p style="margin:24px 0 0;"><a href="${content.link}" style="display:inline-block;background:#fdb913;color:#000;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700;">Open in AtomQuest</a></p>`
    : '';

  return `
    <div style="font-family:Inter,Arial,sans-serif;background:#0a0a0a;color:#f5f5f5;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#111111;border:1px solid #262626;border-radius:16px;padding:24px;">
        <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#fdb913;">${content.title}</h2>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#e5e5e5;">${content.message}</p>
        ${facts}
        ${linkBlock}
      </div>
    </div>
  `;
}

export function buildEmailText(content: NotificationContent) {
  const factText = content.facts?.length
    ? `\n${content.facts.map((fact) => `${fact.label}: ${fact.value}`).join('\n')}`
    : '';
  const linkText = content.link ? `\nOpen: ${content.link}` : '';
  return `${content.title}\n\n${content.message}${factText}${linkText}`.trim();
}

export function buildTeamsCard(content: NotificationContent) {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.5',
          body: [
            { type: 'TextBlock', size: 'Large', weight: 'Bolder', color: 'Accent', text: content.title },
            { type: 'TextBlock', wrap: true, text: content.message, spacing: 'Small' },
            ...(content.facts?.length
              ? [
                  {
                    type: 'FactSet',
                    facts: content.facts.map((fact) => ({ title: fact.label, value: fact.value })),
                  },
                ]
              : []),
          ],
          actions: content.link
            ? [
                {
                  type: 'Action.OpenUrl',
                  title: 'Open in AtomQuest',
                  url: content.link,
                },
              ]
            : [],
        },
      },
    ],
  };
}
