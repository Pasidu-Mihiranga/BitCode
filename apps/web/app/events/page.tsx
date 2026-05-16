import { redirect } from "next/navigation";

/** Legacy URL — marketplace lives at `/`. */
export default function EventsIndexRedirect() {
  redirect("/");
}
