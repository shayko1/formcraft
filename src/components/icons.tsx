/**
 * Explicit Lucide imports so the bundler tree-shakes unused icons.
 * Do not `import * as LucideIcons` — that pulls ~900KB into the client.
 */
import type { LucideIcon } from "lucide-react";
import {
  AlignLeft,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AtSign,
  BringToFront,
  Calendar,
  Car,
  CheckSquare,
  ChevronDown,
  ChevronDownSquare,
  ChevronUp,
  CircleDot,
  Clock,
  Copy,
  FileText,
  GripHorizontal,
  GripVertical,
  Hash,
  Heading,
  Image,
  Inbox,
  Link,
  Magnet,
  Mail,
  MousePointer2,
  Move,
  Paperclip,
  PartyPopper,
  Phone,
  Rows3,
  SendToBack,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  Type,
  Wrench,
  X,
} from "lucide-react";

const ICONS = {
  AlignLeft,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AtSign,
  BringToFront,
  Calendar,
  Car,
  CheckSquare,
  ChevronDown,
  ChevronDownSquare,
  ChevronUp,
  CircleDot,
  Clock,
  Copy,
  FileText,
  GripHorizontal,
  GripVertical,
  Hash,
  Heading,
  Image,
  Inbox,
  Link,
  Magnet,
  Mail,
  MousePointer2,
  Move,
  Paperclip,
  PartyPopper,
  Phone,
  Rows3,
  SendToBack,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  Type,
  Wrench,
  X,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  className = "h-4 w-4",
}: {
  name: string;
  className?: string;
}) {
  const C = ICONS[name as IconName];
  if (!C) return null;
  return <C className={className} aria-hidden />;
}
