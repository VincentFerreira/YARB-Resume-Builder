import { CVData } from './types';

export const INITIAL_CV_DATA: CVData = {
  personalInfo: {
    firstName: "Christophe",
    lastName: "ROGER",
    title: "Architecte Logiciel | Développeur/Concepteur Java/JEE",
    email: "christophe.roger@mail.com",
    medium: "medium.com/@christopheroger",
    location: "2 Rue du quartier, 98765 Ville, Pays",
    linkedin: "linkedin.com/in/christopheroger",
    github: "github.com/darwiin",
    photo: "https://picsum.photos/200/200",
    summary: "Développeur et concepteur JEE depuis plusieurs années, j'ai également une expérience de développement sur l'ensemble de l'écosystème Java (Android, J2ME sur PDA et Javacard sur chipset NFC). J'occupe aujourd'hui un poste d'architecte logiciel et reste passionné par mon métier et par les nouvelles technologies en général."
  },
  skills: [
    {
      id: "1",
      name: "Programmation",
      items: "Java (JEE, JSE, JME, Java Card Platform), Microsoft .Net (C#), Typescript, Javascript, CSS"
    },
    {
      id: "2",
      name: "Frameworks",
      items: "Spring, Spring Boot, Ionic 3, Angular 2, Angular 4, ZK, JBoss RichFaces"
    },
    {
      id: "3",
      name: "Bases de données",
      items: "IBM DB2, Oracle Database, Microsoft SQL Server, MySQL, PostgreSQL"
    },
    {
      id: "4",
      name: "Outils",
      items: "IntelliJ Idea, Eclipse, Visual Studio Code, Maven, Ant, SVN, git"
    }
  ],
  experience: [
    {
      id: "exp1",
      role: "Architecte logiciel | Développeur/Concepteur Senior JEE",
      company: "EPI",
      location: "Nouvelle-Calédonie",
      startDate: "Décembre 2015",
      endDate: "Aujourd'hui",
      description: [
        "Reconstruction de la plateforme d'intégration",
        "Migration de l'ensemble des projets Java sous Maven",
        "Evolutions et corrections des bugs du framework de développement interne",
        "Veille technologique"
      ],
      techStack: "Apache Tomcat, IntelliJ Idea, Eclipse, Maven, Spring Boot, Jenkins, Nexus"
    },
    {
      id: "exp2",
      role: "Architecte logiciel | Développeur/Concepteur Senior JEE",
      company: "CAFAT",
      location: "Nouvelle-Calédonie",
      startDate: "Avril 2014",
      endDate: "Novembre 2015",
      description: [
        "Support et encadrement technique des équipes de développement",
        "Suivi, validation et intégration des développements externalisés",
        "Implémentation, analyse et livraison de correctifs de bugs sur les applicatifs métiers"
      ],
      techStack: "JBoss EAP, IntelliJ Idea, Eclipse, Maven"
    }
  ],
  education: [
    {
      id: "edu1",
      degree: "Master 2 Informatique",
      school: "Université de Bordeaux",
      location: "France",
      startDate: "2007",
      endDate: "2008",
      description: "Spécialité Génie Logiciel"
    }
  ],
  languages: ["Français (Langue maternelle)", "Anglais (Courant)"]
};
