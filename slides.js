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
        <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Eum, facere magni? Debitis necessitatibus sint tempora. Ab autem commodi dignissimos earum eligendi facere facilis fugiat ipsa iste labore minus, molestias non odio possimus quam repudiandae suscipit? Aliquid asperiores dolor magnam modi nostrum provident repudiandae! Culpa in quam quas quibusdam ullam veniam vero! Adipisci autem consequatur cupiditate dolor dolore eum expedita facilis fugit ipsum nulla, odit porro quo quos veritatis voluptatem voluptates voluptatibus. Aperiam, asperiores commodi delectus dolore, ducimus in natus placeat quo repellat sunt veritatis voluptate! Accusamus aliquid assumenda consequuntur corporis fugit illo in, iusto molestiae nam nihil, quidem ratione velit, voluptatibus? Atque culpa dolore dolorem eligendi impedit in iste iusto laboriosam, mollitia nulla, odit, officiis omnis provident sapiente voluptate. Culpa dolor dolore nemo perspiciatis voluptate? Ab, dicta eaque magnam maxime molestias mollitia obcaecati odit perspiciatis repudiandae tempore ut voluptas voluptatem! Adipisci amet beatae consequatur corporis dicta doloremque esse eum explicabo facere incidunt libero nihil nisi officia pariatur quisquam quod, recusandae rerum sequi sint sit soluta tempora ullam, vel veritatis voluptatem? Eos error quae reiciendis saepe sapiente. Autem consectetur culpa eligendi numquam optio praesentium quis repudiandae tenetur vel vero. Amet atque beatae, cumque cupiditate delectus dignissimos eveniet explicabo ipsum itaque necessitatibus, nisi, possimus quaerat recusandae sit sunt! Accusantium dolores modi sapiente voluptatem? Adipisci dignissimos eligendi in magni, neque temporibus. A aspernatur esse illum incidunt labore, maiores natus, necessitatibus nisi non odit quae quam quisquam, quod repellat sint tenetur vel vero. Aliquid asperiores at atque aut, doloribus eligendi placeat quaerat quia quod sint soluta, sunt ullam voluptatum? Ab autem error ex impedit modi, praesentium provident repudiandae. Assumenda atque ipsam, libero maxime modi quibusdam recusandae! Architecto autem blanditiis consequatur hic! Adipisci animi, aperiam ducimus enim eos error esse eveniet fuga iste nesciunt non officia possimus quibusdam sequi similique suscipit ullam voluptas voluptates voluptatibus!</p>
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