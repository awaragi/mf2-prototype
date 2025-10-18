export default [
  {
    id: "intro",
    title: "Welcome to Our Presentation",
    template: "html",
    html: `
      <div style="text-align: center;">
        <h1 style="font-size: 3rem;">Welcome</h1>
        <p style="font-size: 1.5rem;">
          Thank you for joining us today. We're excited to share our insights and discoveries with you.
        </p>
        <p style="font-size: 1.2rem;">
          Let's begin our journey together
        </p>
        <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Accusamus blanditiis dicta inventore, labore nihil nobis optio saepe soluta vel vitae. Asperiores dolorem dolorum harum itaque non, repellendus unde. Accusantium consequatur deleniti distinctio, ducimus earum esse est eveniet expedita illo illum ipsam, ipsum iure iusto magni nisi nulla pariatur rem repellendus rerum sed sint voluptas voluptatum! Adipisci assumenda dolore doloribus enim et id, libero magnam molestias nostrum obcaecati quibusdam saepe, sed tenetur vitae voluptatem. Aliquid at corporis debitis dignissimos dolor earum esse fugit iste, nostrum perspiciatis quasi quia quis quisquam repudiandae sequi suscipit tempora veniam? Consequatur ex maiores mollitia nulla tenetur.</p>
      </div>
    `
  },

  {
    id: "agenda",
    title: "Today's Agenda",
    template: "html",
    html: `
      <div style="text-align: center;">
        <h2 style="font-size: 2.5rem;">Agenda</h2>
        <ol style="font-size: 1.3rem;">
          <li>Introduction & Overview</li>
          <li>Key Findings & Analysis</li>
          <li>Visual Examples</li>
          <li>Q&A and Next Steps</li>
        </ol>
      </div>
    `,
    additional: `
      <p style="font-size: 1rem;">
        <strong>Note:</strong> This presentation includes interactive elements. Feel free to ask questions at any time during our discussion.
      </p>
    `
  },

  {
    id: "details",
    title: "Key Details & Insights",
    template: "html",
    html: `
      <div style="text-align: center;">
        <h2 style="font-size: 2.2rem;">Key Insights</h2>
        <div>
          <h3 style="font-size: 1.5rem;">Performance</h3>
          <p style="font-size: 3rem;">95%</p>
          <p style="font-size: 1.1rem;">Improvement in efficiency</p>
        </div>
        <div>
          <h3 style="font-size: 1.5rem;">Satisfaction</h3>
          <p style="font-size: 3rem;">4.8/5</p>
          <p style="font-size: 1.1rem;">User satisfaction rating</p>
        </div>
      </div>
    `,
    additional: `
      <div>
        <h4 style="font-size: 1.3rem;">Supporting Details:</h4>
        <ul style="font-size: 1rem;">
          <li>Comprehensive analysis conducted over 6-month period</li>
          <li>Data collected from 1,200+ participants across multiple demographics</li>
          <li>Statistical significance verified with 95% confidence interval</li>
          <li>Results validated through peer review and independent verification</li>
          <li>Implementation recommendations based on evidence-based findings</li>
        </ul>
      </div>
    `
  },

  {
    id: "image-1",
    title: "System Architecture Diagram",
    template: "img",
    src: "https://via.placeholder.com/1024x768/E31937/FFFFFF?text=System+Architecture+Diagram"
  },

  {
    id: "gallery",
    title: "Team Collaboration",
    template: "img",
    src: "https://via.placeholder.com/1024x768/5236AB/FFFFFF?text=Team+Working+Together",
    additional: `
      <div style="text-align: center;">
        <p style="font-size: 1.2rem;">
          Our diverse team of experts collaborating on innovative solutions that drive meaningful results for our clients.
        </p>
        <p style="font-size: 1rem;">
          Photo taken at our innovation lab during the quarterly planning session.
        </p>
      </div>
    `
  },

  {
    id: "outro",
    title: "Thank You",
    template: "html",
    html: `
      <div style="text-align: center;">
        <h2 style="font-size: 3rem;">Thank You</h2>
        <p style="font-size: 1.8rem;">Questions & Discussion</p>
        <p style="font-size: 1.2rem;">
          We appreciate your time and attention.<br>
          Let's continue the conversation.
        </p>
      </div>
    `
  }
];