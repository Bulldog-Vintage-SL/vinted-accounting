import Link from "next/link";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

// CHATGPT PROMPT TO GENERATE YOUR PRIVACY POLICY — replace with your own data 👇

// 1. Go to https://chat.openai.com/
// 2. Copy paste bellow
// 3. Replace the data with your own (if needed)
// 4. Paste the answer from ChatGPT directly in the <pre> tag below

// You are an excellent lawyer.

// I need your help to write a simple privacy policy for my website. Here is some context:
// - Website: https://Reventa Libertad.com
// - Name: Reventa Libertad
// - Description: A JavaScript code boilerplate to help entrepreneurs launch their startups faster
// - User data collected: name, email and payment information
// - Non-personal data collection: web cookies
// - Purpose of Data Collection: Order processing
// - Data sharing: we do not share the data with any other parties
// - Children's Privacy: we do not collect any data from children
// - Updates to the Privacy Policy: users will be updated by email
// - Contact information: Reventa Libertad@gmail.com

// Please write a simple privacy policy for my site. Add the current date.  Do not add or explain your reasoning. Answer:

export const metadata = getSEOTags({
  title: `Privacy Policy | ${config.appName}`,
  canonicalUrlRelative: "/privacy-policy",
});

const PrivacyPolicy = () => {
  return (
    <main className="max-w-xl mx-auto">
      <div className="p-5">
        <Link href="/" className="btn btn-ghost">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M15 10a.75.75 0 01-.75.75H7.612l2.158 1.96a.75.75 0 11-1.04 1.08l-3.5-3.25a.75.75 0 010-1.08l3.5-3.25a.75.75 0 111.04 1.08L7.612 9.25h6.638A.75.75 0 0115 10z"
              clipRule="evenodd"
            />
          </svg>{" "}
          Back
        </Link>
        <h1 className="text-3xl font-extrabold pb-6">
          Privacy Policy for {config.appName}
        </h1>

        <pre
          className="leading-relaxed whitespace-pre-wrap"
          style={{ fontFamily: "sans-serif" }}
        >
          {`Privacy Policy — Reventa Libertad
Last updated: December 2, 2025

This Privacy Policy explains how Reventa Libertad (“we”, “our”, “us”) collects, uses, and protects your information when you use https://Reventa Libertad.com
 (“Website”). By using the Website, you agree to the practices described in this policy.

1. Information We Collect
Personal Data

We collect the following personal information when you place an order or interact with our Website:

Name

Email address

Payment information

Non-Personal Data

We use web cookies and similar technologies to gather non-personal information such as browser type, device details, and site usage statistics.


2. Google User Data

If you choose to connect your Google account, Reventa Libertad may request read-only access to certain Gmail data through the Gmail API. This may include email metadata such as sender, subject, timestamps, and email content when necessary to provide the application's functionality.

This access is strictly read-only. Reventa Libertad does not send emails, delete emails, or modify your mailbox in any way.

Non-Personal Data

We use web cookies and similar technologies to gather non-personal information such as browser type, device details, and site usage statistics.


3. Purpose of Data Collection

We collect and process your data for the following purposes:

Processing purchases and providing access to digital downloads  
Providing the core functionality of the Reventa Libertad service  
Improving application performance and user experience  
Communicating with you about purchases, updates, or support

Google user data is accessed only to provide the functionality of the application and is not used for advertising or unrelated purposes.

4. Use of Google API Data

Reventa Libertad’s use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.

Google user data is only used to provide or improve the application's functionality and is never sold, shared, or used for advertising purposes.

5. Data Sharing

We do not sell, trade, or distribute your personal data or Google user data to any third parties.

Data may be shared with trusted service providers only when necessary to operate the service, such as payment processors handling secure payment transactions.

4. Data Storage and Retention

We retain personal data only for as long as necessary to provide our services, comply with legal obligations, and maintain system security.

Users may request deletion of their data at any time by contacting us.

If you disconnect your Google account from Reventa Libertad, we will no longer access your Gmail data.

6. Data Security

We take reasonable technical and organizational measures to protect your information from unauthorized access, alteration, or disclosure. These measures include secure HTTPS encryption, restricted system access, and secure server infrastructure.


7. Children’s Privacy

We do not knowingly collect personal information from children. If we become aware that we have received information from a child, we will delete it promptly.

8. Cookies

Cookies are used to enhance user experience and analyze website usage. You may disable cookies through your browser settings, though some features of the Website may not function properly.

9. Updates to This Privacy Policy

We may update this Privacy Policy periodically. If changes are made, users will be notified by email using the address provided during their purchase.

10. Contact

If you have any questions or concerns regarding this Privacy Policy, please contact us at:
Reventa Libertad@gmail.com

By using the Website, you acknowledge that you have read and agreed to this Privacy Policy.`}
        </pre>
      </div>
    </main>
  );
};

export default PrivacyPolicy;
