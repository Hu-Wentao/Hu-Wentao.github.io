(() => {
  const content = document.querySelector(".post-content");
  const headings = content
    ? [...content.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]")]
    : [];

  if (!content || headings.length === 0) return;

  const rail = document.createElement("nav");
  rail.className = "article-rail";
  rail.setAttribute("aria-label", "文章章节导航");

  const list = document.createElement("ol");
  const preview = document.createElement("div");
  const previewTitle = document.createElement("strong");
  const previewExcerpt = document.createElement("p");
  const minimumLevel = Math.min(...headings.map((heading) => Number(heading.tagName.slice(1))));
  let previewAnchor = null;

  preview.className = "article-rail-preview";
  preview.setAttribute("aria-hidden", "true");
  preview.append(previewTitle, previewExcerpt);

  const headingTitle = (heading) =>
    [...heading.childNodes]
      .filter((node) => !(node.nodeType === Node.ELEMENT_NODE && node.classList.contains("anchor")))
      .map((node) => node.textContent)
      .join("")
      .trim();

  const headingExcerpt = (heading) => {
    const parts = [];
    let sibling = heading.nextElementSibling;

    while (sibling && !/^H[1-6]$/.test(sibling.tagName) && parts.join(" ").length < 180) {
      if (!sibling.matches("pre, .highlight")) {
        const text = sibling.textContent.replace(/\s+/g, " ").trim();
        if (text) parts.push(text);
      }
      sibling = sibling.nextElementSibling;
    }

    const excerpt = parts.join(" ");
    if (!excerpt) return "点击跳转到这一章节";
    return excerpt.length > 180 ? `${excerpt.slice(0, 180).trim()}…` : excerpt;
  };

  const positionPreview = (anchor) => {
    const rect = anchor.getBoundingClientRect();
    const label = anchor.querySelector(".article-rail-label");
    const previewHeight = preview.offsetHeight;
    const previewWidth = preview.offsetWidth;
    const preferredTop = rect.top + rect.height / 2 - previewHeight / 2;
    const top = Math.min(
      Math.max(16, preferredTop),
      Math.max(16, window.innerHeight - previewHeight - 16),
    );
    const preferredLeft = rect.right + (label ? label.offsetWidth : 0) + 32;
    const left = Math.min(preferredLeft, window.innerWidth - previewWidth - 16);
    preview.style.top = `${top}px`;
    preview.style.left = `${Math.max(104, left)}px`;
  };

  const showPreview = (anchor, heading) => {
    previewAnchor = anchor;
    previewTitle.textContent = headingTitle(heading);
    previewExcerpt.textContent = headingExcerpt(heading);
    preview.classList.add("is-visible");
    requestAnimationFrame(() => positionPreview(anchor));
  };

  const hidePreview = () => {
    previewAnchor = null;
    preview.classList.remove("is-visible");
  };

  const links = headings.map((heading) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    const label = document.createElement("span");
    const level = Number(heading.tagName.slice(1));
    const title = headingTitle(heading);

    link.href = `#${encodeURIComponent(heading.id)}`;
    link.className = "article-rail-mark";
    link.style.setProperty("--heading-depth", String(level - minimumLevel));
    link.setAttribute("aria-label", title);
    label.className = "article-rail-label";
    label.textContent = title;
    link.appendChild(label);

    link.addEventListener("mouseenter", () => showPreview(link, heading));
    link.addEventListener("mouseleave", hidePreview);
    link.addEventListener("focus", () => showPreview(link, heading));
    link.addEventListener("blur", hidePreview);

    item.appendChild(link);
    list.appendChild(item);
    return link;
  });

  rail.appendChild(list);
  document.body.append(rail, preview);

  let activeIndex = -1;
  let ticking = false;

  const updateActiveHeading = () => {
    const activationLine = Math.min(180, window.innerHeight * 0.28);
    let nextIndex = 0;

    headings.forEach((heading, index) => {
      if (heading.getBoundingClientRect().top <= activationLine) nextIndex = index;
    });

    if (nextIndex !== activeIndex) {
      if (links[activeIndex]) {
        links[activeIndex].classList.remove("is-active");
        links[activeIndex].removeAttribute("aria-current");
      }
      links[nextIndex].classList.add("is-active");
      links[nextIndex].setAttribute("aria-current", "location");
      activeIndex = nextIndex;
    }

    ticking = false;
  };

  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateActiveHeading);
  };

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", () => {
    requestUpdate();
    if (previewAnchor) positionPreview(previewAnchor);
  });
  updateActiveHeading();
})();
