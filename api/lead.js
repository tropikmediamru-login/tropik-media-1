// Vercel serverless function — receives "Book a Meeting" form submissions
// from book.html and forwards them to Wix as CRM contacts.
//
// Wix Headless setup:
//   1. In the Wix site dashboard, create an API Key (Settings > Headless Settings,
//      or via the Wix Developers Center) with the "Manage Contacts" permission scope.
//   2. Copy the Site ID from Settings > General Settings.
//   3. Add WIX_API_KEY and WIX_SITE_ID as environment variables in the Vercel
//      project (Project Settings > Environment Variables) and redeploy.
//   4. No code changes needed — once both vars are set, submissions are created
//      as contacts in the Wix CRM automatically.
//
// Docs: https://dev.wix.com/docs/rest/crm/contacts/contacts/create-contact

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { firstName, lastName, email, phone, company, message } = req.body || {};

  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: 'First name, last name, and email are required.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const { WIX_API_KEY, WIX_SITE_ID } = process.env;

  if (WIX_API_KEY && WIX_SITE_ID) {
    try {
      const wixRes = await fetch('https://www.wixapis.com/contacts/v4/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: WIX_API_KEY,
          'wix-site-id': WIX_SITE_ID,
        },
        body: JSON.stringify({
          info: {
            name: { first: firstName, last: lastName },
            emails: { items: [{ email, tag: 'MAIN' }] },
            ...(phone ? { phones: { items: [{ phone, tag: 'MAIN' }] } } : {}),
            ...(company ? { company } : {}),
            extendedFields: {
              // Key is provisioned on the Wix "Tropik Media" project (Wix appends a
              // unique suffix to custom-field keys). See backend/backend-spec.md.
              items: { 'custom.project-details-kcttddyvagvlqryswyt': message || '' },
            },
          },
        }),
      });

      if (!wixRes.ok) {
        console.error('Wix contact creation failed:', wixRes.status, await wixRes.text());
        return res.status(502).json({ error: 'Could not reach Wix CRM. Please try again shortly.' });
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Wix request error:', err);
      return res.status(502).json({ error: 'Could not reach Wix CRM. Please try again shortly.' });
    }
  }

  // Wix Headless isn't connected yet — log the lead so nothing is lost
  // until WIX_API_KEY / WIX_SITE_ID are configured (see notes above).
  console.log('New lead (Wix not configured):', { firstName, lastName, email, phone, company, message });
  return res.status(200).json({ ok: true });
};
