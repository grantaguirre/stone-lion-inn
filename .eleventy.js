`use strict`;

const browserslist                = require('browserslist');
const eleventyAutoCacheBuster     = require('eleventy-auto-cache-buster');
const markdownItFootnote          = require('markdown-it-footnote');
const eleventyPluginFilesMinifier = require('@sherby/eleventy-plugin-files-minifier');
const esbuild                     = require('esbuild');
const { execSync }                = require('child_process')
const format                      = require('date-fns/format');
const Image                       = require('@11ty/eleventy-img');
const markdownIt                  = require('markdown-it');
const markdownItAttrs             = require('markdown-it-attrs');
const { minify }                  = require('terser');
const outdent                     = require('outdent');
const path                        = require('path');
const pluginSEO                   = require('eleventy-plugin-seo');
// Next 2 constants for JS bundling browser targets
const {resolveToEsbuildTarget}    = require('esbuild-plugin-browserslist');
const target                      = resolveToEsbuildTarget(browserslist(
    'production' [
      '>0.2%',
      'Firefox ESR',
      'not dead',
      'not op_mini all'
    ],
      'development' [
      'last 1 chrome version',
      'last 1 firefox version',
      'last 1 safari version'
    ]
  ), {
  printUnknownTargets: false,
});

/**
 * @param {*} doc A real big object full of all sorts of information about a document.
 * @returns {String} the markup of the first image.
 */
function extractFirstImage(doc) {
  if (!doc.hasOwnProperty(`templateContent`)) {
    console.warn(`❌ Failed to extract image: Document has no property 'templateContent'.`);
    return;
  }

  const content = doc.templateContent;

  if (content.includes(`<img`)) {
    const imgTagBegin = content.indexOf(`<img`);
    const imgTagEnd = content.indexOf(`>`, imgTagBegin);

    return content.substring(imgTagBegin, imgTagEnd + 1);
  }

  return ``;
}

module.exports = async function(eleventyConfig) {

  const {EleventyRenderPlugin} = await import(`@11ty/eleventy`);

  // Require layout file extensions; see
  // https://www.11ty.dev/docs/layouts/#omitting-the-layouts-file-extension
  eleventyConfig.setLayoutResolution(false);

  // Copy assets to build directory
  eleventyConfig.addPassthroughCopy(`src/assets/images`);
  eleventyConfig.addPassthroughCopy(`src/assets/fonts`);
  eleventyConfig.addPassthroughCopy(`src/assets/files`);
  // Image shortcode
  const imageShortcode = async (
    src,
    className = undefined,
    alt,
    caption,
    widths = [400, 800, 1280, 1600],
    formats = [`webp`, `jpeg`],
    sizes = [`25vw`, `50vw`, `75vw`, `100vw`]
  ) => {

    const imageMetadata = await Image(src, {
      widths: [...widths, null],
      formats: [...formats, null],
      outputDir: `_site/assets/images`,
      urlPath: `/assets/images`,
    });

    /** Maps a config of attribute-value pairs to an HTML string
     * representing those same attribute-value pairs.
     */
    const stringifyAttributes = (attributeMap) => {
      return Object.entries(attributeMap)
        .map(([attribute, value]) => {
          if (typeof value === `undefined`) return ``;
          return `${attribute}="${value}"`;
        })
        .join(` `);
    };

    const sourceHtmlString = Object.values(imageMetadata)
      // Map each format to the source HTML markup
      .map((images) => {
        // The first entry is representative of all the others
        // since they each have the same shape
        const { sourceType } = images[0];

        // Use our util from earlier to make our lives easier
        const sourceAttributes = stringifyAttributes({
          type: sourceType,
          // srcset needs to be a comma-separated attribute
          srcset: images.map((image) => image.srcset).join(`, `),
          sizes
        });

        // Return one <source> per format
        return `<source ${sourceAttributes}>`;
      })
      .join(`\n`);

    const getLargestImage = (format) => {
      const images = imageMetadata[format];
      return images[images.length - 1];
    }

    const largestUnoptimizedImg = getLargestImage(formats[0]);
    const imgAttributes = stringifyAttributes({
      src: largestUnoptimizedImg.url,
      width: largestUnoptimizedImg.width,
      height: largestUnoptimizedImg.height,
      alt,
      loading: `lazy`,
      decoding: `async`,
    });
    const imgHtmlString = `<img ${imgAttributes}>`;

    const pictureAttributes = stringifyAttributes({
      class: className,
    });
    if (caption === undefined) caption = ``;
    const picture = `<figure><picture ${pictureAttributes}>
      ${sourceHtmlString}
      ${imgHtmlString}
    </picture><figcaption>${caption}</figcaption></figure>`;

    return outdent`${picture}`;
  };
  // SEO
  eleventyConfig.addPlugin(pluginSEO, {
    title: `Stone Lion Inn`,
    description: `A historic haunted bed and breakfast located in Guthrie, Oklahoma`,
    url: `https://stonelioninn.com`,
    author: `Chris J. Zähller`,
    image: `/assets/images/site/sli-logo.webp/`,
    options: {
      titleDivider: `|`,
      imageWithBaseUrl: true,
      twitterCardType: `summary_large_image`,
      showPageNumbers: false
    }
  });
  // Needed for paired shortcodes
  eleventyConfig.addPlugin(EleventyRenderPlugin);
  // For inline SVG; see https://medium.com/@brettdewoody/inlining-svgs-in-eleventy-cffb1114e7b
  eleventyConfig.addNunjucksAsyncShortcode(`svgIcon`, async (src) => {
    let metadata = await Image(src, {
      formats: [`svg`],
      dryRun: true,
    })
    return metadata.svg[0].buffer.toString()
  });
  // JS inline minfication
  eleventyConfig.addNunjucksAsyncFilter(`jsmin`, async function (
    code,
    callback
  ) {
    try {
      const minified = await minify(code);
      callback(null, minified.code);
    } catch (err) {
      console.error(`Terser error: `, err);
      // Fail gracefully.
      callback(null, code);
    }
  });
  // Register image shortcode
  eleventyConfig.addNunjucksAsyncShortcode(`image`, imageShortcode);
  // Extended Markdown

  // For Markdown attributes
  const markdownItOptions = {
    html: true,
    breaks: true,
    linkify: true
  };

  const markdownLib = markdownIt(markdownItOptions).use(
    markdownItAttrs
  ).use(
    markdownItFootnote
  );

  eleventyConfig.setLibrary(`md`, markdownLib);

  // Cache busting
  eleventyConfig.addPlugin(eleventyAutoCacheBuster, {
    globstring: `**/*.{css,js,png,jpg,jpeg,gif,webp,svg,mp4,ico}`
  });

  // HTML minification
  eleventyConfig.addPlugin(eleventyPluginFilesMinifier);

  // JS  & CSS bundling, tree-shaking, & minification
  eleventyConfig.on(`eleventy.before`, async () => {
    await esbuild.build({
      entryPoints: [`src/assets/js/index.js`, `src/assets/css/index.css`],
      bundle: true,
      treeShaking: true,
      outdir: `_site/assets/`,
      sourcemap: true,
      minify: true,
      target // From our constant, set at top of file
    });
  });

  // Watch directories for changes
  eleventyConfig.addWatchTarget(`./src/assets/css/`);

  eleventyConfig.addWatchTarget(`./src/assets/js/`);

  // add `date` filter
  eleventyConfig.addFilter(`date`, function (date, dateFormat) {
    return format(date, dateFormat)
  })

  eleventyConfig.addPassthroughCopy({
    // Copy `/favicon/` to `_site/` (Don't use template string around key)
    'favicon': `/`
  });
  // Set custom directory for input; otherwise use defaults
  return {
    // Site URL
    url: `https://stonelioninn.com`,
    // When a passthrough file is modified, rebuild the pages:
    passthroughFileCopy: true,
    // Copy any file in these formats:
    templateFormats: [`html`, `njk`, `md`, `js`, `woff2`],
    markdownTemplateEngine: `njk`,
    htmlTemplateEngine: `njk`,
    dataTemplateEngine: `njk`,
    // Set up directory structure:
    dir: {
      input: `src`,
    },
  };
};
