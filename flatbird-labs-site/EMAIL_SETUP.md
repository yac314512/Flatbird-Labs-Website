# Email Setup

The lead form now does two things:

1. Stores every submission in `data/leads.jsonl` as a backup
2. Sends an email notification through SMTP

If SMTP is not configured or email delivery fails, the lead is still saved locally, but the form returns an error so the issue is visible.

## Environment Variables

Set these values locally in `.env` or in your hosting provider's environment settings:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `LEADS_TO`

Use `.env.example` as the template.

## Render Setup

In Render, open the Flatbird Labs service and set:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `LEADS_TO`

Then redeploy the service.

## Recommended Provider

Any SMTP provider will work. Common options:

- Google Workspace SMTP with an app password
- SendGrid SMTP
- Postmark SMTP
- Resend SMTP

## Submission Behavior

Successful email delivery:

- form returns success to the visitor
- lead is saved to `data/leads.jsonl`

Failed email delivery:

- lead is still saved to `data/leads.jsonl`
- form returns an error so you know email delivery needs attention
- the saved record includes `notificationStatus` and `notificationError`
