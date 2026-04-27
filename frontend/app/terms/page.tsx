import type { Metadata } from 'next';
import { LegalList, LegalNote, LegalSection, LegalShell } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title: 'Terms & Conditions · BumperBid',
  description:
    'Terms & Conditions governing the use of BumperBid, a unit of Zidan Auto Pvt Ltd.',
};

export default function TermsPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Terms & Conditions"
    >
      <p className="text-bone/70">
        By registering on or placing a bid through BumperBid, you agree to the
        following terms. These terms are binding and apply to every auction
        conducted on the platform.
      </p>

      <LegalSection index={1} title="Auction approval & vehicle condition">
        <LegalList>
          <li>All auctions are subject to approval from sellers.</li>
          <li>
            All vehicles are sold on an{' '}
            <span className="text-bone">&ldquo;As-is, Where-is&rdquo;</span>{' '}
            basis.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection index={2} title="PCC (Pollution Clearance Certificate)">
        <LegalList ordered>
          <li>
            A valid PCC is a mandatory requirement for certain insurance
            companies. Where a PCC is required, it will be clearly mentioned in
            the vehicle remarks. The winning buyer must provide a valid PCC
            certificate within two (2) days of such winning, if a PCC has not
            already been provided.
          </li>
          <li>
            The winning shall be <span className="text-bone">null &amp; void</span>{' '}
            if the buyer fails to provide a PCC within 2 days of winning.
          </li>
          <li>
            If the insurance company approves such winnings and the buyer still
            fails to provide the PCC, it will be considered a back-out. As per
            the back-out policy, the buyer&apos;s ID will be deactivated followed
            by forfeiture of any deposit.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection index={3} title="Bid commitment & vehicle lifting">
        <LegalList>
          <li>Buyers must honor every bid placed in the auction.</li>
          <li>
            If approved, vehicle lifting must be completed within{' '}
            <span className="text-bone">3 days</span>, excluding lockdown days
            (if any).
          </li>
          <li>
            This TAT of 3 days may vary on a case-to-case basis based on the
            insurance company&apos;s request and shall be binding on the buyer
            in such cases. For these exceptional cases, BumperBid will clearly
            communicate the applicable timeline to the winning buyer at the
            time of sharing the approval.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection index={4} title="Auction service fee & quote validity">
        <LegalList ordered>
          <li>
            A BumperBid auction service fee is charged{' '}
            <span className="text-bone">over and above</span> the quoted price.
            The fee is generally{' '}
            <span className="text-bone">4% of the quoted amount</span> but may
            vary on a case-to-case basis. For further clarification, please
            connect with the concerned auction manager.
          </li>
          <li>
            Auctions are post-approval. Your quote shall be valid for a minimum
            of <span className="text-bone">30 days</span> from the auction end
            date for cases <em>with papers</em>, and{' '}
            <span className="text-bone">60 days</span> for cases{' '}
            <em>without papers (scrap)</em>.
          </li>
          <li>
            Once the quote is approved, the buyer must deposit the service fee
            within <span className="text-bone">1 business day</span> of
            BumperBid sharing the approval.
          </li>
          <li>
            BumperBid will provide the DD / Title / Insured details only after
            receiving the BumperBid service fee.
          </li>
          <li>
            The buyer must deposit the complete approved amount to the
            Financer / Insured / BumperBid. No amount shall be withheld by the
            buyer on any account.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection index={5} title="Deal reassignment">
        <p>
          If the winning buyer fails to submit the full service fee within 1
          business day, BumperBid reserves the right to offer the deal to
          another buyer &mdash; with or without intimating the original winning
          buyer.
        </p>
      </LegalSection>

      <LegalSection index={6} title="Ownership transfer">
        <LegalList ordered>
          <li>
            The buyer must transfer ownership within{' '}
            <span className="text-bone">3 months</span> from the date of
            lifting.
          </li>
          <li>
            The buyer must provide repaired / under-repair photos and the
            vehicle location <span className="text-bone">every 15 days</span>{' '}
            to the BumperBid team.
          </li>
          <li>
            Failure to comply will lead to deactivation of the buyer&apos;s ID,
            cancellation of RC, or transfer of ownership to the buyer&apos;s
            name for the said vehicle.
          </li>
          <li>
            The buyer must get the ownership transferred to their own name or
            to the end user within{' '}
            <span className="text-bone">90 days</span>.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection index={7} title="Payments">
        <LegalList>
          <li>
            The buyer must deposit any NOC, service fee, security, advance, or
            any auction-related payment only via{' '}
            <span className="text-bone">NEFT / online mode</span>.
          </li>
          <li>
            Any cash deposited will{' '}
            <span className="text-bone">not be refunded</span> under any
            circumstances.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection index={8} title="Insurance">
        <p>
          The buyer must procure a TP (Third-Party) policy at the time of
          lifting or deposit the TP premium amount with BumperBid.
        </p>
      </LegalSection>

      <LegalNote>
        Please physically inspect the vehicle to be sure of the extent of
        damage before placing your bid. No request for amount revision at the
        time of lifting of the vehicle will be entertained.
      </LegalNote>
    </LegalShell>
  );
}
