import type { Metadata } from 'next';
import { LegalList, LegalSection, LegalShell } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title: 'Privacy Policy · BumperBid',
  description:
    'How BumperBid, a unit of Zidan Auto Pvt Ltd, collects, uses, and protects your information.',
};

export default function PrivacyPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Privacy Policy"
    >
      <p className="text-bone/70">
        BumperBid (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), a
        unit of Zidan Auto Pvt Ltd, operates an online auction platform for
        vehicles. This Privacy Policy explains what information we collect,
        how we use it, and the rights you have over your data.
      </p>

      <LegalSection index={1} title="Information we collect">
        <p className="text-bone/80">
          We collect the following categories of information when you register,
          verify your account, and participate in auctions:
        </p>
        <LegalList>
          <li>
            <span className="text-bone">Account &amp; identity:</span> full
            name, mobile number, email address, and KYC documents such as PAN,
            Aadhaar, GSTIN, trade certificate, and dealership details.
          </li>
          <li>
            <span className="text-bone">Auction activity:</span> bid history,
            auction participation, transaction records, and saved searches or
            vehicle preferences.
          </li>
          <li>
            <span className="text-bone">Payments:</span> bank account details
            for NEFT transactions and refunds, along with invoice records.
          </li>
          <li>
            <span className="text-bone">Device &amp; usage:</span> device
            identifiers, IP address, browser type, pages viewed, actions taken,
            session timestamps, and cookies.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection index={2} title="How we use your information">
        <LegalList>
          <li>To verify your identity and eligibility to bid.</li>
          <li>
            To process bids, winnings, approvals, service-fee collection, and
            vehicle lifting.
          </li>
          <li>
            To communicate auction outcomes, approvals, payment instructions,
            and support responses.
          </li>
          <li>
            To comply with legal obligations, including sharing information
            with insurance companies, sellers, and statutory authorities where
            required.
          </li>
          <li>To prevent fraud, protect platform integrity, and enforce our Terms.</li>
          <li>To improve platform features, performance, and user experience.</li>
        </LegalList>
      </LegalSection>

      <LegalSection index={3} title="Sharing your information">
        <p className="text-bone/80">
          We share your information only where it is necessary to deliver the
          service or where required by law:
        </p>
        <LegalList>
          <li>
            <span className="text-bone">Sellers &amp; insurance companies</span>{' '}
            &mdash; for auction approval, ownership transfer, and supporting
            documentation.
          </li>
          <li>
            <span className="text-bone">Statutory &amp; regulatory authorities</span>{' '}
            &mdash; where disclosure is required by law.
          </li>
          <li>
            <span className="text-bone">Payment processors &amp; banks</span> &mdash;
            to enable transactions, refunds, and reconciliation.
          </li>
          <li>
            <span className="text-bone">Service providers</span> &mdash;
            operating under confidentiality obligations on our behalf (for
            example, cloud hosting, messaging, or analytics).
          </li>
        </LegalList>
        <p className="text-bone/80">
          We do <span className="text-bone">not</span> sell your personal
          information to third parties.
        </p>
      </LegalSection>

      <LegalSection index={4} title="Data retention">
        <p>
          We retain your data for as long as your account remains active, and
          thereafter for the period required to comply with legal, tax,
          accounting, and audit obligations &mdash; typically a minimum of{' '}
          <span className="text-bone">8 years</span> for financial records.
        </p>
      </LegalSection>

      <LegalSection index={5} title="Your rights">
        <p className="text-bone/80">You have the right to:</p>
        <LegalList>
          <li>Access a copy of the personal data we hold about you.</li>
          <li>Request correction of inaccurate or outdated data.</li>
          <li>
            Request deletion of your account and data, subject to legal
            retention obligations.
          </li>
          <li>
            Withdraw consent where processing relies on consent, without
            affecting the lawfulness of prior processing.
          </li>
        </LegalList>
        <p className="text-bone/80">
          To exercise any of these rights, write to us at{' '}
          <a
            className="font-medium text-brand-400 hover:text-brand-300 hover:underline"
            href="mailto:support@bumperbid.in"
          >
            support@bumperbid.in
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection index={6} title="Security">
        <p>
          We apply industry-standard safeguards to protect your information,
          including encryption in transit, restricted access controls, and
          periodic audits. No method of transmission over the Internet is 100%
          secure, so we cannot guarantee absolute security, but we continuously
          work to strengthen our defences.
        </p>
      </LegalSection>

      <LegalSection index={7} title="Cookies">
        <p>
          We use cookies and similar technologies to maintain session state,
          remember preferences, and analyse platform usage. You can manage
          cookies through your browser settings; disabling them may affect
          certain features.
        </p>
      </LegalSection>

      <LegalSection index={8} title="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. Material changes
          will be reflected on this page along with an updated{' '}
          <em>Last updated</em> date. Continued use of BumperBid after such
          changes constitutes acceptance of the revised policy.
        </p>
      </LegalSection>

      <LegalSection index={9} title="Contact">
        <p>
          For questions about this Privacy Policy or how we handle your data,
          please contact:
        </p>
        <p className="text-bone">
          BumperBid &mdash; A unit of Zidan Auto Pvt Ltd.
          <br />
          Email:{' '}
          <a
            className="font-medium text-brand-400 hover:text-brand-300 hover:underline"
            href="mailto:support@bumperbid.in"
          >
            support@bumperbid.in
          </a>
        </p>
      </LegalSection>
    </LegalShell>
  );
}
