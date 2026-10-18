"use client";

import { Send } from "lucide-react";

/**
 * Contact form. Until a transactional email provider (Resend) is wired up,
 * this opens the visitor's mail client addressed to the restaurant.
 */
export default function ContactForm({ email }: { email: string }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        const subject = encodeURIComponent(String(d.get("subject") ?? "Enquiry"));
        const body = encodeURIComponent(
          `${d.get("message")}\n\n— ${d.get("name")}\nPhone: ${d.get("phone") || "-"}\nEmail: ${d.get("email")}`
        );
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
      }}
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <div className="form-group">
          <label htmlFor="contact-name" className="form-label">Your Name *</label>
          <input id="contact-name" name="name" type="text" className="form-input" placeholder="Amir Sheikh" required />
        </div>
        <div className="form-group">
          <label htmlFor="contact-phone" className="form-label">Phone</label>
          <input id="contact-phone" name="phone" type="tel" className="form-input" placeholder="+91 98765 43210" />
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="contact-email" className="form-label">Email Address *</label>
        <input id="contact-email" name="email" type="email" className="form-input" placeholder="you@example.com" required />
      </div>
      <div className="form-group">
        <label htmlFor="contact-subject" className="form-label">Subject</label>
        <select id="contact-subject" name="subject" className="form-input">
          <option>General Enquiry</option>
          <option>Order Issue</option>
          <option>Bulk / Catering Order</option>
          <option>Feedback</option>
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="contact-message" className="form-label">Message *</label>
        <textarea id="contact-message" name="message" className="form-input" rows={5} placeholder="How can we help you?" required style={{ resize: "vertical" }} />
      </div>
      <button type="submit" className="btn btn--primary btn--full btn--lg">
        <Send size={18} /> Send Message
      </button>
    </form>
  );
}
