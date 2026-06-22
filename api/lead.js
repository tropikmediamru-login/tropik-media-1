// Vercel serverless function — receives "Book a Meeting" form submissions
// from book.html and saves them to the Wix CRM as contacts.
//
// Behaviour:
//   - Creates a new Wix contact tagged with the "Website Lead" label, with the
//     project brief stored in the "Project Details" custom field.
//   - If the email or phone already belongs to a contact, Wix rejects the create
//     with 409 DUPLICATE_CONTACT_EXISTS. We then update that existing contact
//     instead (re-apply the label + refresh the project details) so repeat
//     submissions succeed rather than showing an error.
//
// Requires Vercel env vars WIX_API_KEY + WIX_SITE_ID. The API key needs the
// "Wix Contacts & Members (Manage)" scope. If the vars are missing, the lead is
// logged and the request still succeeds so nothing is lost.
//
// Docs: https://dev.wix.com/docs/rest/crm/contacts/contacts/create-contact

const WIX_BASE = 'https://www.wixapis.com/contacts/v4/contacts';
const LEAD_LABEL_KEY = 'custom.website-lead';
// Wix appends a unique suffix to custom-field keys. See backend/backend-spec.md.
const PROJECT_DETAILS_KEY = 'custom.project-details-kcttddyvagvlqryswyt';

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

  // Wix Headless isn't connected yet — log the lead so nothing is lost.
  if (!WIX_API_KEY || !WIX_SITE_ID) {
    console.log('New lead (Wix not configured):', { firstName, lastName, email, phone, company, message });
    return res.status(200).json({ ok: true });
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: WIX_API_KEY,
    'wix-site-id': WIX_SITE_ID,
  };
  const wix = (path, method, body) =>
    fetch(WIX_BASE + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });

  try {
    // 1) Try to create a brand-new contact.
    const createRes = await wix('', 'POST', {
      info: {
        name: { first: firstName, last: lastName },
        emails: { items: [{ email, tag: 'MAIN' }] },
        ...(phone ? { phones: { items: [{ phone, tag: 'MAIN' }] } } : {}),
        ...(company ? { company } : {}),
        // Tag every lead with "Website Lead" so a Wix automation can notify the team.
        labelKeys: { items: [LEAD_LABEL_KEY] },
        extendedFields: { items: { [PROJECT_DETAILS_KEY]: message || '' } },
      },
    });

    if (createRes.ok) {
      return res.status(200).json({ ok: true });
    }

    // 2) Already a contact? Update it instead of failing the submission.
    const errText = await createRes.text();
    let parsed = null;
    try { parsed = JSON.parse(errText); } catch {}
    const appErr = parsed && parsed.details && parsed.details.applicationError;

    if (createRes.status === 409 && appErr && appErr.code === 'DUPLICATE_CONTACT_EXISTS') {
      const contactId = appErr.data && appErr.data.duplicateContactId;
      if (contactId && (await updateExistingContact(wix, contactId, message))) {
        return res.status(200).json({ ok: true });
      }
    }

    console.error('Wix contact creation failed:', createRes.status, errText);
    return res.status(502).json({ error: 'Could not reach Wix CRM. Please try again shortly.' });
  } catch (err) {
    console.error('Wix request error:', err);
    return res.status(502).json({ error: 'Could not reach Wix CRM. Please try again shortly.' });
  }
};

// Re-apply the "Website Lead" label and refresh the project details on a contact
// that already exists. Returns true once the contact has been tagged.
async function updateExistingContact(wix, contactId, message) {
  // Add the label (additive — keeps any existing labels). The response carries
  // the contact's current revision, needed for the follow-up update.
  const labelRes = await wix(`/${contactId}/labels`, 'POST', { labelKeys: [LEAD_LABEL_KEY] });
  if (!labelRes.ok) {
    console.error('Wix label-contact failed:', labelRes.status, await labelRes.text());
    return false;
  }

  // Only refresh the project brief when the visitor actually included one.
  if (message) {
    const revision = (await labelRes.json().catch(() => ({})))?.contact?.revision;
    const updateRes = await wix(`/${contactId}`, 'PATCH', {
      revision,
      info: { extendedFields: { items: { [PROJECT_DETAILS_KEY]: message } } },
    });
    if (!updateRes.ok) {
      // Label is applied and the contact exists — still a success for the visitor;
      // just log the detail-refresh failure.
      console.error('Wix update-contact failed:', updateRes.status, await updateRes.text());
    }
  }

  return true;
}
