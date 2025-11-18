const path = require('path');
const fs = require('fs');
const utils = require('./utils');
const chrome = require('selenium-webdriver/chrome');
const { Builder, By } = require('selenium-webdriver');

const args = process.argv.slice(2);
const logger = utils.logger;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Convert array of objects to CSV string.
 * Keeps JSON-style data in memory but outputs CSV for Excel/Sheets.
 */
const convertToCSV = (arr) => {
  if (!arr.length) return '';

  const header = Object.keys(arr[0]).join(',');
  const lines = arr.map((obj) =>
    Object.values(obj)
      .map((v) => {
        const val = String(v ?? '');
        // Escape double quotes by doubling them, wrap everything in quotes.
        return `"${val.replace(/"/g, '""')}"`
      })
      .join(',')
  );

  return [header, ...lines].join('\n');
};

/**
 * Scrape all listings on the current page and push into `results`.
 */
const scrapeCurrentPage = async (driver, results) => {
  const listings = await driver.findElements(By.css('.c411Listing.jsResultsList'));

  logger.info(`[nameCollector]::Found ${listings.length} listings on this page`);

  for (const listing of listings) {
    try {
      const nameEl = await listing.findElement(By.css('.c411ListedName a'));
      const phoneEl = await listing.findElement(By.css('.c411Phone'));
      const addrEl = await listing.findElement(By.css('.adr'));

      const name = await nameEl.getText();
      const phone = await phoneEl.getText();
      const address = await addrEl.getText();

      results.push({ name, phone, address });
    } catch (innerErr) {
      logger.warn('[nameCollector]::Failed to parse one listing: ' + innerErr.message);
    }
  }
};

/**
 * Get total number of pages by reading numeric <li> texts in the pagination bar.
 */
const getTotalPages = async (driver) => {
  try {
    const pager = await driver.findElement(By.css('ul.c411Paging')); // first pager (top)
    const liElems = await pager.findElements(By.css('li'));

    let totalPages = 0;
    for (const li of liElems) {
      try {
        const txt = (await li.getText()).trim();
        // Only count pure numeric entries like "1", "2", "3", ...
        if (/^\d+$/.test(txt)) {
          const num = parseInt(txt, 10);
          if (num > totalPages) totalPages = num;
        }
      } catch (_) {
        // ignore li we can't read
      }
    }

    if (!totalPages) {
      logger.warn('[nameCollector]::Could not detect total pages, defaulting to 1');
      return 1;
    }

    logger.info(`[nameCollector]::Detected ${totalPages} pages from nav`);
    return totalPages;
  } catch (err) {
    logger.error('[nameCollector]::Failed to read pagination: ' + err.message);
    return 1;
  }
};

const scrape = async (driver, args) => {
  const results = []; // JSON-style data kept in memory
  const csvPath = path.resolve(__dirname, 'results.csv');

  try {
    // Initial load – this should land us on page 1 with <li class="selected">1</li>
    await driver.get('https://www.canada411.ca/search/?stype=si&what=imran&where=GTA');
    await sleep(2000);

    const totalPages = await getTotalPages(driver);

    // We assume we start on page 1
    for (let page = 1; page <= totalPages; page++) {
      logger.info(`[nameCollector]::Scraping page ${page}/${totalPages}`);

      // Scrape all listings on this page
      await scrapeCurrentPage(driver, results);

      // If not the last page, click the page number (page + 1)
      if (page < totalPages) {
        const targetPageText = String(page + 1);
        logger.info(
          `[nameCollector]::Attempting to navigate to page ${targetPageText}/${totalPages}`
        );

        let clicked = false;

        try {
          const pager = await driver.findElement(By.css('ul.c411Paging')); // top pager
          const liElems = await pager.findElements(By.css('li'));

          for (const li of liElems) {
            try {
              const txt = (await li.getText()).trim();

              // Match the numeric label we want, e.g. "2", "3", ...
              if (txt === targetPageText) {
                try {
                  const link = await li.findElement(By.css('a'));
                  await link.click();
                  await sleep(2000);
                  logger.info(
                    `[nameCollector]::Switched to page ${targetPageText}/${totalPages} via label match`
                  );
                  clicked = true;
                  break;
                } catch (navErr) {
                  logger.error(
                    `[nameCollector]::Failed to click page ${targetPageText}: ${navErr.message}`
                  );
                }
              }
            } catch (_) {
              // ignore li without text or without anchor
            }
          }
        } catch (pagerErr) {
          logger.error('[nameCollector]::Error while handling pagination: ' + pagerErr.message);
        }

        if (!clicked) {
          logger.warn(
            `[nameCollector]::Could not find clickable li for page "${targetPageText}", stopping pagination`
          );
          break;
        }
      }
    }

    // Convert in-memory JSON data to CSV and write it
    const csvData = convertToCSV(results);
    fs.writeFileSync(csvPath, csvData, 'utf8');
    logger.info(
      `[nameCollector]::Saved ${results.length} contacts to ${csvPath} (CSV from JSON data)`
    );
  } catch (error) {
    logger.error('[nameCollector]::Error: ' + error.message);
  } finally {
    await driver.quit();
  }
};

(async function main() {
  const chromePath = '/usr/local/bin/chrome-linux/chrome';

  let options = new chrome.Options();
  // options.addArguments('--headless');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--disable-web-security');
  options.addArguments('--disable-popup-blocking');
  options.addArguments('--disable-blink-features=AutomationControlled');
  options.setChromeBinaryPath(chromePath);

  let driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  try {
    await scrape(driver, args);
  } catch (error) {
    console.error('[nameCollector]::Error in main function: ' + error.message);
    try {
      await driver.quit();
    } catch {}
  }
})();
