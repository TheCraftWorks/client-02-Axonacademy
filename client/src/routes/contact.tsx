import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "../components/site/Layout";
import { MapPin, Mail, Phone, Clock, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { defaultOrganization, normalizeOrganization } from "@/lib/organization";
import { submitToGoogleSheet } from "@/lib/googleSheets.ts";
export const Route = createFileRoute("/contact")({ component: Contact });

function Contact() {
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [contactInfo, setContactInfo] = useState(defaultOrganization);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    interest: "",
    message: ""
  });

  useEffect(() => {
    async function loadContact() {
      try {
        const res = await api.get("/public/contact-details");
        if (res.success && res.contactDetails) {
          setContactInfo(normalizeOrganization(res.contactDetails));
        }
      } catch (err) {
        console.error("Failed to load contact info:", err);
      }
    }
    loadContact();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  setIsSubmitting(true);
  setErrorMsg("");

  try {
    const result = await submitToGoogleSheet(
      "Contact Inquiries",
      {
        Timestamp: new Date().toISOString(),
        Name: formData.name,
        Email: formData.email,
        Phone: formData.phone,
        Interest: formData.interest,
        Message: formData.message,
      }
    );

    if (result.success) {
      setSent(true);

      setFormData({
        name: "",
        email: "",
        phone: "",
        interest: "",
        message: "",
      });
    } else {
      setErrorMsg(result.message);
    }
  } catch (error) {
    console.error(error);
    setErrorMsg("Failed to submit inquiry");
  } finally {
    setIsSubmitting(false);
  }
};
  return (
    <PublicLayout>
      <section className="relative py-20 lg:py-28 overflow-hidden bg-navy">
        <div className="absolute -z-10 top-0 right-0 h-[400px] w-[400px] rounded-full bg-gold/20 blur-3xl" />
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-gold">— Contact</div>
          <h1 className="mt-3 max-w-3xl font-display text-4xl lg:text-7xl font-extrabold text-white tracking-[-0.03em] leading-[1.02]">
            Let's start your<br /><span className="text-gold">healthcare career.</span>
          </h1>
        </div>
      </section>

      <section className="pb-24 bg-light-gray">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 grid lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2 space-y-4">
            {[
              { icon: MapPin, t: "Visit us", v: contactInfo.address },
              { icon: Phone, t: "Call us", v: contactInfo.phone },
              { icon: Mail, t: "Email", v: contactInfo.email },
              { icon: Clock, t: "Office", v: contactInfo.hours },
            ].map(c => (
              <div key={c.t} className="rounded-2xl border border-gray-100 bg-white p-5 flex gap-4 shadow-sm">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-navy text-white shrink-0">
                  <c.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display font-bold text-navy">{c.t}</div>
                  <div className="mt-1 text-sm text-gray-600">{c.v}</div>
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleSubmit}
            className="lg:col-span-3 rounded-3xl border border-gray-100 bg-white p-8 lg:p-10 shadow-sm"
          >
            <h2 className="font-display text-2xl font-extrabold text-navy">Tell us about you.</h2>
            <p className="mt-2 text-sm text-gray-500">A counsellor will reach out within 24 hours.</p>
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <Field 
                label="Full name" 
                placeholder="Priya Krishnan" 
                required 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
              <Field 
                label="Email" 
                type="email" 
                placeholder="you@example.com" 
                required 
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
              <Field 
                label="Phone" 
                placeholder="+91 98xxx xxxxx" 
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
              />
              <Field 
                label="Interest" 
                placeholder="Staff Nursing, OT Tech…" 
                value={formData.interest}
                onChange={e => setFormData({ ...formData, interest: e.target.value })}
              />
            </div>
            <div className="mt-4">
              <label className="block text-xs font-bold text-navy mb-1.5">Message</label>
              <textarea 
                rows={5} 
                placeholder="Anything you'd like us to know…" 
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy" 
                value={formData.message}
                onChange={e => setFormData({ ...formData, message: e.target.value })}
              />
            </div>
            {errorMsg && (
              <p className="mt-4 text-xs text-red-500 font-medium">{errorMsg}</p>
            )}
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 text-sm font-bold text-navy hover:bg-gold/90 transition disabled:opacity-50"
            >
              {sent ? "Sent — we'll be in touch ✓" : isSubmitting ? "Sending..." : <>Send message <Send className="h-4 w-4" /></>}
            </button>
          </form>
        </div>
      </section>
    </PublicLayout>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-navy mb-1.5">{label}</label>
      <input {...props} className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
    </div>
  );
}


