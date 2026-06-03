import { Eye, Users, TrendingUp, Trophy, Headphones } from "lucide-react";

interface JobPosting {
  title: string;
  location: string;
  type: string;
  jobDescriptionLink: string;
}

interface VendorBenefit {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const jobPostings: JobPosting[] = [
];

export const currentPatners = [
  {
    name: "Happy Coffee",
    logo: "https://1iustwinxvwsck3s.public.blob.vercel-storage.com/HappyCoffeeLogo.jpg",
  },
  {
    name: "Purple Jasmine Cafe",
    logo: "https://1iustwinxvwsck3s.public.blob.vercel-storage.com/PurpleJasmineCafeLogo.jpg",
  },
  {
    name: "Top Bean",
    logo: "https://1iustwinxvwsck3s.public.blob.vercel-storage.com/TopBeanLogo.png",
  },
  {
    name: "Kastanos Cafe",
    logo: "https://1iustwinxvwsck3s.public.blob.vercel-storage.com/KastanosCafeLogo.jpg",
  },
]

export const vendorBenefits: VendorBenefit[] = [
  {
    title: "Increased Visibility",
    description: "Reach thousands of coffee enthusiasts actively seeking quality coffee stores and specialty vendors.",
    icon: Eye,
  },
  {
    title: "Customer Connection",
    description: "Build loyalty and meaningful relationships with customers who appreciate your brand and offerings.",
    icon: Users,
  },
  {
    title: "Growth Analytics",
    description: "Access valuable insights about your store performance, customer preferences, and engagement metrics.",
    icon: TrendingUp,
  },
  {
    title: "Brand Authority",
    description: "Establish your authority in the specialty coffee market and showcase your expertise to coffee lovers.",
    icon: Trophy,
  },
  {
    title: "Dedicated Support",
    description: "Get dedicated partnership support to help grow your business and maximize your presence on Coffee Sphut.",
    icon: Headphones,
  },
];

export const vendorFAQs = [
  {
    question: "What is Coffee Sphut?",
    answer: "Coffee Sphut (“Sphut” is pronounced as “spot”) is a mobile app that helps coffee lovers discover cafés and coffee shops in Africa. It also provides cafés with visibility, engagement tools, and structured data to help understand their customers and trends."
  },
  {
      question: "How much does it cost to be listed?",
      answer: "There is no cost to join Coffee Sphut. Your café/coffee shop can appear on our app for free. However, premium features like featured placement, ads or additional analytics have optional pricing.",
  },
  {
      question: "How do users find my café?",
      answer: "Users can search by location, café type, amenities, and trending spots. We also promote cafés through curated content, stories, and recommendations in the app.",
  },
  {
      question: "What is the loyalty program and how does it work?",
      answer: "Our digital loyalty program lets you reward repeat customers through the app. Customers have a QR code that allows them to earn stamps when they visit your café. It’s fully tracked digitally, simple for your staff, and helps keep your customers coming back. You can customize the reward for your customers.",
  },
  {
      question: "Do I need special equipment for this to work?",
      answer: "No equipment is required. Everything is handled via the app. Staff can validate loyalty stamps digitally, and all content or updates can be managed via your phone or laptop.",
  },
  {
      question: "What kind of data will I get?",
      answer: "We provide basic analytics for each café, like how many users viewed your profile, saved your café, or engaged with your content. You also get access to customer insights such as their preferences, customer trends and more. This helps you understand your audience, turn the data into sales and make better marketing decisions",
  },
  {
      question: "Can I control what information appears about my café?",
      answer: "Absolutely! You provide your café info, opening hours, photos, amenities and so on. You can update details anytime through with our support team.",
  },
  {
      question: "How long does it take to get listed?",
      answer: "Once you complete a short questionnaire, we can have your café live in a couple hours.",
  },
  {
      question: "Can I track performance of the loyalty program?",
      answer: "Yes!  You’ll have access to basic stats, like stamps redeemed, current stamped number and repeat customers. This helps you see what’s working and adjust rewards if needed.",
  },
]
