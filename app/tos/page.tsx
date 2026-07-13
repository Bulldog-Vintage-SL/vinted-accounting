import Link from "next/link";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

// CHATGPT PROMPT TO GENERATE YOUR TERMS & SERVICES — replace with your own data 👇

// 1. Go to https://chat.openai.com/
// 2. Copy paste bellow
// 3. Replace the data with your own (if needed)
// 4. Paste the answer from ChatGPT directly in the <pre> tag below

// You are an excellent lawyer.

// I need your help to write a simple Terms & Services for my website. Here is some context:
// - Website: https://Reventa Libertad.com
// - Name: Reventa Libertad
// - Contact information: Reventa Libertad@gmail.com
// - Description: A JavaScript code boilerplate to help entrepreneurs launch their startups faster
// - Ownership: when buying a package, users can download code to create apps. They own the code but they do not have the right to resell it. They can ask for a full refund within 7 day after the purchase.
// - User data collected: name, email and payment information
// - Non-personal data collection: web cookies
// - Link to privacy-policy: https://Reventa Libertad.com/privacy-policy
// - Governing Law: Spain
// - Updates to the Terms: users will be updated by email

// Please write a simple Terms & Services for my site. Add the current date. Do not add or explain your reasoning. Answer:

export const metadata = getSEOTags({
  title: `Terms and Conditions | ${config.appName}`,
  canonicalUrlRelative: "/tos",
});

const TOS = () => {
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
          </svg>
          Back
        </Link>
        <h1 className="text-3xl font-extrabold pb-6">
          Terms and Conditions for {config.appName}
        </h1>

        <pre
          className="leading-relaxed whitespace-pre-wrap"
          style={{ fontFamily: "sans-serif" }}
        >
          {`Last Updated: September 26, 2023

**Terms & Services — Reventa Libertad**
**Last updated: December 2, 2025**

These Terms & Services (“Terms”) govern your use of **Reventa Libertad** (“we”, “our”, “us”) and the services provided through **[https://Reventa Libertad.com](https://Reventa Libertad.com)** (“Website”). By accessing or using the Website, you agree to these Terms.

---

## 1. Description of Service

Reventa Libertad provides a JavaScript code boilerplate designed to help entrepreneurs launch their startups faster. Users may purchase packages that allow them to download code to build their own applications.

---

## 2. Ownership and Usage Rights

When you purchase a package from Reventa Libertad, you receive the right to download and use the provided code for your personal or business projects.

You **retain ownership** of any code you build using our boilerplate; however, you **may not resell, redistribute, or sublicense** the boilerplate code or any substantial derivative of it as a standalone product.

---

## 3. Refund Policy

You may request a **full refund within 7 days** of your purchase. After this period, all sales are considered final. Refund requests may be submitted to:
**[Reventa Libertad@gmail.com](mailto:Reventa Libertad@gmail.com)**

---

## 4. User Data

We collect the following personal information when you interact with our Website:

* Name
* Email address
* Payment information

Our use and handling of personal data is governed by our Privacy Policy:
**[https://Reventa Libertad.com/privacy-policy](https://Reventa Libertad.com/privacy-policy)**

---

## 5. Cookies and Non-Personal Data

The Website uses cookies and other tracking technologies to improve user experience and analyze website usage. These cookies may collect non-personal information such as browser type, device information, and general usage behavior.

---

## 6. User Responsibilities

By using Reventa Libertad, you agree to:

* Provide accurate information during purchase.
* Use the downloaded code in accordance with these Terms.
* Not attempt to harm, disrupt, or misuse the Website or its services.

---

## 7. Limitation of Liability

Reventa Libertad is provided “as is” without any warranties, express or implied. We are not responsible for any damages, losses, or issues resulting from the use or misuse of our code, Website, or services.

---

## 8. Governing Law

These Terms are governed by and interpreted in accordance with the laws of **Spain**, without regard to its conflict-of-law provisions.

---

## 9. Updates to the Terms

We may update these Terms from time to time. If changes occur, users will be notified by email using the address provided during purchase.

---

## 10. Contact

For questions or concerns regarding these Terms, please contact us at:
**[Reventa Libertad@gmail.com](mailto:Reventa Libertad@gmail.com)**

---

By using Reventa Libertad or purchasing any package, you acknowledge that you have read, understood, and agreed to these Terms & Services.
`}
        </pre>
      </div>
    </main>
  );
};

export default TOS;
