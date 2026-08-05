import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type OrganizationDetails = {
  name: string;
  url: string;
  email: string;
  phone: string;
  hours: string;
  address: string;
  gst: string;
  timezone: string;
  about: string;
};

export const defaultOrganization: OrganizationDetails = {
  name: "Axon Med Academy",
  url: "axon.academy",
  email: "hello@axon.academy",
  phone: "+91 98765 43210",
  hours: "Monday - Saturday, 9 AM to 8 PM",
  address: "Plot 21, Medical Campus, Hosur Road, Bengaluru - 560001",
  gst: "29AABCM1234C1ZK",
  timezone: "Asia/Kolkata",
  about: "India's most trusted paramedical training academy.",
};

export function normalizeOrganization(raw: Partial<OrganizationDetails> = {}): OrganizationDetails {
  return {
    ...defaultOrganization,
    ...Object.fromEntries(
      Object.entries(raw).filter(([, value]) => value !== undefined && value !== null && value !== "")
    ),
  };
}

export function useOrganizationDetails() {
  const [organization, setOrganization] = useState<OrganizationDetails>(defaultOrganization);

  useEffect(() => {
    let mounted = true;

    api.get("/public/contact-details")
      .then((res) => {
        if (mounted && res.success && res.contactDetails) {
          setOrganization(normalizeOrganization(res.contactDetails));
        }
      })
      .catch((err) => {
        console.error("Failed to load organization details:", err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return organization;
}
