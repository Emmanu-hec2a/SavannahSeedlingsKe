// Business/legal review is required before these drafts become final policies.
// Do not invent fixed refund windows, retention periods, or compliance claims.
export const legalPolicies = {
  privacy: {
    title: 'Privacy Policy',
    path: '/privacy-policy',
    updated: '28 October 2026',
    dateTime: '2026-10-28',
    introduction: 'How Savannah Seedlings handles information when you browse, create an account, place a seedling order, or enquire about our farming services.',
    sections: [
      {
        id: 'who-we-are', title: 'Who handles your information',
        paragraphs: ['Savannah Seedlings operates this storefront and handles customer enquiries through its nursery team in Kenya. Contact us using the details below for privacy questions or requests. This draft describes the current website and WhatsApp-first ordering flow.'],
      },
      {
        id: 'information', title: 'Information you provide',
        items: [
          'Account information, such as your email address and login credentials. If you choose Google sign-in when available, we receive information needed to identify your account, not your Google password.',
          'Order information: your name, email, phone or WhatsApp number, seedlings and quantities, county, town, delivery address and landmarks, order status, and payment records when payment is confirmed.',
          'Service enquiries and information you choose to share with our team, including farm requirements, photographs, or a location pin sent through WhatsApp. The storefront does not request automatic GPS access.',
          'Technical request information, such as IP addresses, browser details and security logs, handled by the systems that operate the site.',
        ],
      },
      {
        id: 'purposes', title: 'Why information is used',
        paragraphs: [
          'Information supports account access, order preparation, delivery quotations, fulfilment, service enquiries, customer support, fraud prevention and transaction records. Processing may be needed to take steps you request, fulfil an agreement, meet a legal obligation, or protect legitimate operational and security interests. Consent is sought where required.',
          'You can browse without an account. Contact and delivery fields are required to save a delivery order; without them we cannot arrange that order. An order or enquiry is not, by itself, permission for unrelated marketing.',
        ],
      },
      {
        id: 'storage', title: 'Browser storage and cookies',
        paragraphs: [
          'The storefront uses local browser storage to remember your cart, wishlist, theme, signed-in session and dismissed review reminders. Tab-session storage can contain an in-progress checkout and saved order details, including contact and delivery information, to help recover an interrupted checkout.',
          'Sign out on shared devices. Browser controls can clear saved site data, but doing so may remove your cart or sign you out. Our current storefront does not add an advertising or analytics tracker. Hosting, security and optional sign-in providers may use their own cookies or similar technologies.',
          'The current homepage newsletter form shows a local confirmation only; it does not submit your email to our backend or register a mailing-list subscription.',
        ],
      },
      {
        id: 'sharing', title: 'WhatsApp and service providers',
        paragraphs: [
          'An order is saved on our backend before WhatsApp opens. Continuing to WhatsApp passes a prepared message containing your contact details, delivery information and order summary to WhatsApp. Opening the draft does not send it automatically; you review and send it yourself. WhatsApp and Meta process information under their own policies.',
          'Hosting and infrastructure providers, including Cloudflare and Railway where configured, process data to operate the site and API. Google may process network information when fonts or optional sign-in resources load. If staff Telegram alerts are enabled, order details such as your name, phone number, address, items and totals are sent to the configured staff chats when an order is saved, even if you do not send the WhatsApp draft.',
          'Where delivery is arranged, the team may share necessary contact and location details with the agreed delivery provider. Requests from authorities are handled where legally required. Ask us for further details about the providers involved in your order.',
        ],
      },
      {
        id: 'retention', title: 'Retention, security and international processing',
        paragraphs: [
          'Order, account and support information may need to remain available for fulfilment, accounting, dispute resolution and applicable recordkeeping duties. Contact us to discuss deletion or retention of your information; we cannot promise immediate deletion of records that must be retained. This draft does not set an unverified fixed retention period.',
          'The website uses access controls and HTTPS where deployed, but no system can guarantee absolute security. Do not send passwords, M-PESA PINs or one-time security codes to the nursery. Some infrastructure or communication providers may process information outside Kenya; provider locations and applicable transfer safeguards must be confirmed as part of business review before this draft is finalised.',
        ],
      },
      {
        id: 'rights', title: 'Your choices and rights',
        paragraphs: ['Subject to applicable law and any permitted exceptions, you may request access, correction or deletion, object to processing, withdraw consent where processing relies on it, and request an eligible copy or transfer of your data. Contact the nursery; we may need to verify your identity. You can also raise a concern with Kenya\'s Office of the Data Protection Commissioner.'],
        links: [{ label: 'Office of the Data Protection Commissioner', href: 'https://www.odpc.go.ke/' }],
      },
      {
        id: 'children-changes', title: 'Children and policy updates',
        paragraphs: ['The storefront is not designed to collect children\'s information. A parent or guardian who believes a child has provided information should contact us. Changes to this policy will be published here with an updated date; material changes to processing should be explained before they apply.'],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    path: '/terms-of-service',
    updated: '28 October 2026',
    dateTime: '2026-10-28',
    introduction: 'The proposed terms for browsing Savannah Seedlings, requesting seedlings, and discussing agronomy support, soil testing and irrigation services with our team.',
    sections: [
      {
        id: 'using-site', title: 'Using the storefront',
        paragraphs: ['This storefront is operated under the Savannah Seedlings brand in Kenya. Provide accurate information, use only accounts and payment methods you are authorised to use, and keep login details private. Do not submit false orders, interfere with the site or attempt unauthorised access. If you cannot enter an agreement yourself, an authorised parent, guardian or representative should act for you.'],
      },
      {
        id: 'catalog', title: 'Seedlings and catalogue information',
        paragraphs: ['Descriptions, photographs and growing guidance help you choose seedlings. Availability and prices can change; the website checks product prices and quantities when saving an order, and the nursery confirms what can be supplied. Seedlings are living plants and may vary in appearance. Ask the team to clarify any variety, size or suitability requirement before agreeing an order.'],
      },
      {
        id: 'ordering', title: 'Orders and WhatsApp confirmation',
        paragraphs: [
          'Review and correct your cart, contact and delivery details before saving. Saving an order records your request; it does not confirm payment, delivery charges or dispatch. The order is saved before a prepared WhatsApp message opens, and you choose whether to send that message.',
          'Confirm availability, the delivery quote, final total and acceptance with the nursery before paying. Keep the agreed quotation and order reference. If details need correcting after saving, contact the team with your order reference rather than submitting duplicate requests.',
        ],
      },
      {
        id: 'prices-payments', title: 'Prices, delivery fees and payment',
        paragraphs: ['Website seedling prices are displayed in Kenyan shillings. Delivery is quoted separately on WhatsApp based on the location and order; it is not automatically free or included in a displayed seedling subtotal. Confirm all charges, any deposit and the balance before payment. The current WhatsApp checkout does not take payment on the website. Opening a payment or WhatsApp link is not proof of payment; use only payment instructions confirmed by the nursery and never share an M-PESA PIN.'],
      },
      {
        id: 'delivery', title: 'Delivery arrangements',
        paragraphs: ['Agree the delivery location, recipient and expected timing with the team. Timing depends on the confirmed order and delivery arrangements; a website request alone is not a guaranteed delivery date. Cross-border requests require individual confirmation of feasibility, costs and destination requirements before commitment. Tell the team promptly if the agreed address or recipient changes.'],
      },
      {
        id: 'services', title: 'Agronomy, soil testing and irrigation',
        paragraphs: ['Savannah directly provides agronomy support, soil testing, and irrigation planning, installation and maintenance. Service enquiries on this website open a WhatsApp draft; they do not automatically book work. Agree the scope, site visits or sample arrangements, fees, timing and any maintenance responsibilities with the team before work starts. Written service-specific terms can clarify the agreed scope without removing mandatory legal rights.'],
      },
      {
        id: 'changes-remedies', title: 'Changes, cancellations and problems',
        paragraphs: ['Contact us promptly if you need to change or cancel an order, or if seedlings arrive damaged, incorrect or incomplete. Provide the order reference and photographs if available so the team can review the issue. Ask before returning living plants so handling and collection can be agreed. Any applicable cancellation, refund, replacement or other remedy must take account of the agreed order and your legal rights; this page does not impose a blanket no-refund rule or an unverified claim deadline.'],
      },
      {
        id: 'growing-results', title: 'Growing results and reasonable care',
        paragraphs: ['Planting and agronomy guidance depends on the variety, soil, weather, water and ongoing care. Descriptions are not a promise of a particular yield, fruiting date or financial return. This does not remove obligations to supply goods and services of the quality and care required by applicable law.'],
      },
      {
        id: 'law-updates', title: 'Privacy, questions and applicable law',
        paragraphs: ['Our Privacy Policy explains the current handling of account, order and enquiry information. These proposed terms are intended for a Kenyan business and are subject to applicable Kenyan law and any mandatory rights that apply to your transaction. Nothing here waives consumer or data-protection rights. Contact us with a concern; you remain free to use lawful complaint or dispute channels. Updates will be dated here and should not retrospectively change an already agreed order.'],
      },
    ],
  },
};
