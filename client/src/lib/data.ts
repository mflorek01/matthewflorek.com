export const skills = [
  { name: "Microsoft Excel", level: 95, expand: "I possess expert proficiency in Microsoft Excel, and am skilled using large databases, pivot tables, data transformation, and complex lookup formulas." },
  { name: "Financial Modeling", level: 80, expand: "From my experience at NAU, I have learned extensively how to make financial forecasts and create models." },
  { name: "Data Analysis", level: 90, expand: "From my internship experience and Business Analytics coursework, I have learned how to analyze data, and use SQL and R to derive useful business insight." },
  { name: "Financial Literacy", level: 85, expand: "My advanced Finance coursework at NAU has given me a robust foundation in financial concepts, project financing, and financial evaluation techniques." },
  { name: "Tableau", level: 75, expand: "Through my Business Analytics education, I have become an adept user of Tableau to create reports and dashboards." },
  { name: "RapidMiner", level: 60, expand: "From my educational experience, I have learned how to effectively use RapidMiner for data mining and data science purposes." },
  { name: "SQL", level: 50, expand: "I learned how to use SQL to query databases from my UC Davis certification and my time at NAU. These experiences have given me a solid foundation that makes me comfortable in any role requiring SQL expertise." },
] as const;
// Another value that exists is skills.desc - creates a secondary line below the title of the skill
export const education = [
  { degree: "B.S. in Finance", institution: "Northern Arizona University", year: "2024" },
  { degree: "Certificate in Business Analytics", institution: "Northern Arizona University", year: "2024" },
  { degree: "SQL For Data Science Certification", institution: "UC Davis Extension", year: "2023" },
  // Add more education items here
] as const;

export const experience = [
  // Add your internships, projects, or relevant coursework here
  { title: "Data Analyst", company: "Neuromemex LLC", duration: "July 2022 - Present", description: "At my internship at Neuromemex, I did extensive data annotation and data quality management. Additionally, I conducted complex data transformations and used Microsoft Excel pivot table reports to deliver insight about their datasets." },
  { title: "AI Data Annotator", company: "Dataannotation.tech", duration: "March 2024 - August 2024", description: "At Dataannotation.tech, I did RLHF fine tuning, which is a necessary step in training AI models to give coherent responses as desired by their creator. As part of this, I graded model responses on a large variety of qualitative metrics, and engineered AI prompts designed to push the limits of the technology in the direction clients desired." },
  { title: "Production Assistant", company: "Northern Arizona University Printing Services", duration: "October 2022 - May 2023", description: "At NAU Printing Services, I was in charge of the finishing process of large-format media pieces, as well as making deliveries. I learned to work with deadlines, be repsponsive to customer requests, and work as part of a well-functioning team." },
] as const;

export const blogPosts = [
  {
    title: "Example Post",
    description: "My approach to analyzing complex datasets and deriving meaningful insights",
    image: "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a",
    content: `
      This is an example post to demonstrate the blog post feature.
    `
  },
] as const;
