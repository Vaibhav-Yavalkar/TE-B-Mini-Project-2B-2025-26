import { createBrowserRouter } from "react-router";
import Home from "./pages/Home";
import LinkAnalyser from "./pages/LinkAnalyser";
import VideoAnalyser from "./pages/VideoAnalyser";
import PlagiarismChecker from "./pages/PlagiarismChecker";
import ImageAnalyser from "./pages/ImageAnalyser";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Subscription from "./pages/Subscription";
import AdminDashboard from "./pages/AdminDashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/signup",
    Component: Signup,
  },
  {
    path: "/subscription",
    Component: Subscription,
  },
  {
    path: "/link-analyser",
    Component: LinkAnalyser,
  },
  {
    path: "/video-analyser",
    Component: VideoAnalyser,
  },
  {
    path: "/plagiarism-checker",
    Component: PlagiarismChecker,
  },
  {
    path: "/audio-analyser",
    Component: PlagiarismChecker,
  },
  {
    path: "/image-analyser",
    Component: ImageAnalyser,
  },
  {
    path: "/admin",
    Component: AdminDashboard,
  },
]);
