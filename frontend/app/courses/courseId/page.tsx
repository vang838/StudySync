import { redirect } from "next/navigation";

export default function LegacyCourseRoute() {
  redirect("/courses/course_search");
}
