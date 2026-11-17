# CircleSeal: QIE Hackathon 3.0 submission kit

Copy-paste text for the submission form, and a script for the demo video. Fill in the `[...]` placeholders after the mainnet deploy.

---

## Form fields

**Project name:** CircleSeal

**One-liner (≤ 120 characters):**
Co-signed receipts and code-enforced savings circles on QIE: proof for the savings groups people already run worldwide.

**Track:** [choose the closest, e.g. DeFi / Real-World / Payments]

**GitHub:** https://github.com/opxy16/circleseal

**Live demo:** [https://…vercel.app]

**Contracts (QIE mainnet, chain 1990):**
- AjoPassbook: [0x…]
- AjoCircle: [0x…]
- AjoForwarder: [0x…]

---

## Short description (~120 words)

Rotating savings groups (ajo in Nigeria, susu in Ghana, tontines in Cameroon, chamas in Kenya, tandas in Mexico) run on trust. When a collector disappears, or a member says "I paid" and the collector says "you didn't", there is no record to settle it. Years of disciplined saving leave no proof a lender will accept.

CircleSeal keeps the savings groups people already run and adds proof on QIE. In **passbook mode**, every cash or transfer payment becomes a receipt signed by both the member and the collector. Nobody can fake it, edit it or deny it, and members need no crypto: CircleSeal pays every fee. In **circle mode**, a stablecoin savings circle runs on code. Bonds, automatic settlement and a payout holdback mean nobody can take the pot and walk away. Members can share a **savings proof link** with lenders.

---

## Longer description (by judging criterion)

**Originality.** Most crypto savings apps ask people to move their money on-chain. CircleSeal starts from how savings groups already work, with cash and bank transfers, and only puts the *proof* on-chain: EIP-712 receipts that need both the collector's and the member's signature. Circle mode adds a **payout holdback**. It is a rule that closes ajo's oldest loophole, the early recipient who stops paying, by prepaying their remaining rounds from their own payout.

**Real-world usefulness.**
- It settles payment disputes with a record neither side can alter.
- It turns years of saving into a portable record, the savings proof page, shareable by link, QR code or PDF.
- CircleSeal never holds naira, so it fits within current rules on handling customer funds.
- No names or phone numbers go on-chain.

**Product quality and UX.**
- The app runs in a phone browser, with no app to install.
- Each member gets a wallet created on their device, locked with a 6-digit PIN.
- Invites and receipts travel as WhatsApp links.
- Gas-free relaying through an ERC-2771 forwarder means members never touch crypto.
- Light and dark themes, a phone tab bar, and a public live stats page.
- 33 contract tests cover cheating attempts, default scenarios and the holdback.

**QIE ecosystem integration.**
- **QIE ID:** members appear by their .qie names, and proof links work as `/proof/name.qie`.
- **QIE Oracle:** the QIE/USDT feed prices the fees CircleSeal pays for members.
- **QIEDEX:** circle wallets swap QUSDC for QIE in-app to cover their own fees.
- **QUSDC:** the currency of circle mode.

**User adoption potential.** Rotating savings groups are used by millions of people on every continent, and their members already live on messaging apps like WhatsApp. CircleSeal's on-ramp is a link: no exchange account, no seed phrase, no fees. Collectors gain credibility to attract members, and members gain a record to show lenders. Both have a reason to bring the other.

---

## Demo video script (about 3 minutes)

> Record in a phone-sized browser window, or with your phone's screen recorder on the live site. Use two browsers to play the collector and the member. Speak slowly. Each scene lists what to show and a line to say.

| # | Time | Show | Say |
|---|---|---|---|
| 1 | 0:00–0:20 | Landing page hero, scroll to "Two ways to save" | "Ajo, susu, tontine, chama: savings groups run on trust, and when trust breaks, there's no record. CircleSeal keeps the groups people already run, and adds proof on QIE." |
| 2 | 0:20–0:45 | Collector: set PIN, create "Market Traders Daily Savings", ₦2,000 daily | "A collector creates a group in seconds. No crypto, no fees: CircleSeal pays them. Only a fingerprint of the name goes on-chain." |
| 3 | 0:45–1:05 | Create invite, tap WhatsApp share; member opens link, joins | "Members join from a WhatsApp link. The link is signed, works once and expires in a week." |
| 4 | 1:05–1:35 | Collector records ₦2,000; member opens confirm link, taps Confirm; CO-SIGNED stamp | "When a member pays, the collector records it, and the member confirms. Now it's a receipt signed by both, on QIE. Nobody can fake it or deny it." |
| 5 | 1:35–1:55 | Member passbook, then "Open my proof page"; show QR and print | "Every receipt builds a savings record the member can share with a lender: how long, how consistently, and how much, checked live on the blockchain." |
| 6 | 1:55–2:30 | Circle page: rotation, countdown, holdback line in history | "Circle mode runs a dollar-stablecoin savings circle on code. Everyone posts a bond. And when someone receives the pot early, part of it prepays their remaining rounds, so nobody can take the money and disappear." |
| 7 | 2:30–2:50 | Stats page: fees paid, QIE price from the oracle, .qie names, contract links | "Everything is public and verifiable: live stats, QIE ID names, fees priced with the QIE oracle, and every contract on the QIE explorer." |
| 8 | 2:50–3:00 | Landing CTA | "CircleSeal. Your savings circle, sealed." |

**Before recording:**
- Use a fresh browser profile so the wallet setup shows.
- Pre-fund the circle wallets with a little QUSDC.
- Create a circle with 5-minute rounds so a settle happens on camera.
