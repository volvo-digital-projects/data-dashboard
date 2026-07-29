const EDITOR_EMAILS = new Set([
  "buleoptimist@gmail.com",
  "hanjh@edutnc.com",
  "hlee1@volvocars.com",
]);

export function isEditorEmail(
  email: string | null | undefined,
): email is string {
  return email ? EDITOR_EMAILS.has(email.trim().toLowerCase()) : false;
}

export const editorEmails = [...EDITOR_EMAILS];
