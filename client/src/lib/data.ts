export const skills = [
  { name: "Data Analysis", level: 90 },
  { name: "Financial Modeling", level: 85 },
  { name: "SQL", level: 88 },
  { name: "Python", level: 82 },
  { name: "Excel/VBA", level: 95 },
  { name: "Power BI", level: 87 },
] as const;

export const education = [
  { degree: "B.S. in Finance & Analytics", institution: "Your University", year: "2023" },
  // Add more education items here
] as const;

export const experience = [
  // Add your internships, projects, or relevant coursework here
  { title: "Finance Intern", company: "Company Name", duration: "Summer 2023", description: "Description of your responsibilities and achievements" },
] as const;

export const blogPosts = [
  {
    title: "Data Analysis Journey",
    description: "My approach to analyzing complex datasets and deriving meaningful insights",
    image: "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a",
    content: `
      As a recent graduate, I've developed a strong foundation in data analysis through both academic projects
      and self-directed learning. My approach focuses on combining statistical analysis with clear visualization
      to tell compelling stories with data.

      Key areas of expertise:
      • Statistical analysis using Python and R
      • Data visualization with Power BI and Tableau
      • SQL database querying and management
      • Excel modeling and VBA automation
    `
  },
  {
    title: "Financial Analysis Expertise",
    description: "How I approach financial modeling and decision-making",
    image: "https://images.unsplash.com/photo-1444653614773-995cb1ef9efa",
    content: `
      My background in finance has equipped me with strong analytical skills and a deep understanding of
      financial markets. I specialize in:

      • Financial statement analysis
      • Valuation modeling
      • Risk assessment
      • Investment analysis

      Through my coursework and projects, I've developed a methodical approach to financial analysis that
      combines quantitative rigor with practical business insights.
    `
  },
] as const;