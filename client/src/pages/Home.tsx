import { Helmet } from "react-helmet";
import Hero from "@/components/Hero";
import SkillsSection from "@/components/SkillsSection";
import BlogPost from "@/components/BlogPost";
import { blogPosts } from "@/lib/data";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Matthew Florek | Data & Financial Analyst</title>
        <meta
          name="description"
          content="Professional portfolio of Matthew Florek, specializing in data analysis and financial modeling."
        />
      </Helmet>

      <Hero />

      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {blogPosts.map((post) => (
              <BlogPost key={post.title} {...post} />
            ))}
          </motion.div>
        </div>
      </section>

      <SkillsSection />
    </>
  );
}