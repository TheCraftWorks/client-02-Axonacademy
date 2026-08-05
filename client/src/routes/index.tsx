import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PublicLayout } from "../components/site/Layout";
import { Hero } from "../components/home/Hero";
import { CourseStrip } from "../components/home/CourseStrip";
import { WhyUs } from "../components/home/WhyUs";
import { PlacementBanner } from "../components/home/PlacementBanner";
import { Testimonials } from "../components/home/Testimonials";
import { Partners } from "../components/home/Partners";
import { LearningPath } from "../components/home/LearningPath";
import { BlogPreview } from "../components/home/BlogPreview";
import { FAQ } from "../components/home/FAQ";
import { CtaBlock } from "../components/home/CtaBlock";
import { useClassroomStore } from "@/lib/classroomStore";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { currentUser } = useClassroomStore();

  if (currentUser) {
    if (currentUser.role === "student") {
      return <Navigate to="/student/dashboard" replace />;
    } else {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  return (
    <PublicLayout>
      <Hero />
      <CourseStrip />
      <WhyUs />
      <PlacementBanner />
      <LearningPath />
      <Testimonials />
      <Partners />
      <BlogPreview />
      <FAQ />
    </PublicLayout>
  );
}
