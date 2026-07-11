import type { FieldConfig, FieldType, FormTheme } from "./form-schema";

// Pre-built templates. Each ships a title, description, theme, and a field list.
// Field ids are template-local and stable so the builder can render immediately;
// they are regenerated to fresh nanoids when a form is created from a template.

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  theme: FormTheme;
  fields: Omit<FieldConfig, "id">[];
}

const f = (
  type: FieldType,
  label: string,
  extra: Partial<Omit<FieldConfig, "id" | "type" | "label">> = {},
): Omit<FieldConfig, "id"> => ({ type, label, required: false, ...extra });

export const TEMPLATES: Template[] = [
  {
    id: "parking",
    name: "Parking / Gate Registration",
    description: "Name, apartment, and phone for a parking gate or building.",
    icon: "Car",
    theme: { accent: "#2563eb", dir: "rtl" },
    fields: [
      f("text", "שם פרטי", { required: true }),
      f("text", "שם משפחה", { required: true }),
      f("number", "מספר דירה", { required: true }),
      f("phone", "טלפון", { required: true, dir: "ltr" }),
    ],
  },
  {
    id: "event",
    name: "Event Signup",
    description: "RSVP with name, email, guests, and dietary notes.",
    icon: "PartyPopper",
    theme: { accent: "#db2777", dir: "ltr" },
    fields: [
      f("text", "Full name", { required: true }),
      f("email", "Email", { required: true, dir: "ltr" }),
      f("number", "Number of guests", { placeholder: "1" }),
      f("select", "Ticket type", { options: ["General", "VIP", "Student"] }),
      f("textarea", "Dietary requirements"),
    ],
  },
  {
    id: "contact",
    name: "Contact / Callback",
    description: "Name, phone, email, and a message.",
    icon: "Mail",
    theme: { accent: "#059669", dir: "ltr" },
    fields: [
      f("text", "Name", { required: true }),
      f("phone", "Phone", { required: true, dir: "ltr" }),
      f("email", "Email", { dir: "ltr" }),
      f("textarea", "How can we help?", { required: true }),
    ],
  },
  {
    id: "complaint",
    name: "Tenant Request / Complaint",
    description: "Maintenance requests with category and urgency.",
    icon: "Wrench",
    theme: { accent: "#ea580c", dir: "rtl" },
    fields: [
      f("text", "שם מלא", { required: true }),
      f("number", "מספר דירה", { required: true }),
      f("phone", "טלפון", { required: true, dir: "ltr" }),
      f("select", "נושא", { required: true, options: ["תחזוקה", "ניקיון", "רעש", "אחר"] }),
      f("radio", "דחיפות", { options: ["נמוכה", "בינונית", "גבוהה"] }),
      f("textarea", "פירוט הבקשה", { required: true }),
    ],
  },
  {
    id: "feedback",
    name: "Feedback Survey",
    description: "Rating-style choices, website, and open comments.",
    icon: "Star",
    theme: { accent: "#7c3aed", dir: "ltr", submitLabel: "Send feedback" },
    fields: [
      f("text", "Name", { required: true }),
      f("email", "Email", { dir: "ltr" }),
      f("radio", "Overall experience", {
        required: true,
        options: ["Excellent", "Good", "Okay", "Poor"],
      }),
      f("checkbox", "What did you like?", {
        options: ["Speed", "Design", "Support", "Price"],
      }),
      f("url", "Your website", { placeholder: "https://", dir: "ltr" }),
      f("date", "Visit date", { dir: "ltr" }),
      f("time", "Preferred callback time", { dir: "ltr" }),
      f("textarea", "Anything else?", { placeholder: "Optional comments" }),
    ],
  },
  {
    id: "custom",
    name: "Blank",
    description: "One field. Build the rest yourself.",
    icon: "Sparkles",
    theme: { accent: "#4f46e5", dir: "ltr" },
    fields: [f("text", "Question 1", { required: true })],
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
