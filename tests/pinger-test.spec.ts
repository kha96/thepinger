import { test, expect, Page, chromium, Browser, ChromiumBrowserContext } from "@playwright/test";

const BOT_TOKEN = process.env.BOT_TOKEN!; 
const CHAT_ID_1 = process.env.CHAT_ID_1!;
const CHAT_ID_2 = process.env.CHAT_ID_2!;
const CHAT_ID_3 = process.env.CHAT_ID_3!;

import dotenv from 'dotenv';

dotenv.config();


async function sendTelegramMessage(chaidID: string, message: string) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const params = {
        chat_id: chaidID,
        text: `${new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Prague' })} - ${message}`,
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(params),
        });

        const data = await response.json();
        console.log("Message sent successfully:", data);
    } catch (error) {
        console.error("Error sending message:", error);
    }
}

const checkTermForCity = async (page: Page, city: string, cityName: string) => {
    var label = "19.10.2024"
    await page.goto(
        "https://ujop.cuni.cz/UJOP-371.html?ujopcmsid=8:zkouska-z-ralii-a-cestiny-pro-obcanstvi-cr"
    );
    await page.locator("#select_misto_zkousky").selectOption(city);
    await page
        .locator("#select_cast_zkousky")
        .selectOption(
            "%C4%8Desk%C3%A9%20re%C3%A1lie%20%2B%20%C4%8Desk%C3%BD%20jazyk"
        );
    
    try {
        await page.locator("#select_termin").selectOption(label);
    } catch {
        label = "7.12.2024"
        try {
            await page.locator("#select_termin").selectOption(label);
        } catch {
            console.log(`No available dates found for ${cityName}`);
            return; // Exit the function, effectively ending the test successfully
        }
    }

    await page.waitForTimeout(3000);
    const response = await page
        .getByRole("button", { name: "Přihlásit" })
        .isEnabled();
    if (response) {
        await sendTelegramMessage(
            CHAT_ID_1, `\n${cityName}\n for term ${label} is bookable,\nhurry up to https://ujop.cuni.cz/UJOP-371.html?ujopcmsid=8:zkouska-z-ralii-a-cestiny-pro-obcanstvi-cr`
        );
        await sendTelegramMessage(
            CHAT_ID_2 , `\n${cityName}\n for term ${label} is bookable,\n hurry up to https://ujop.cuni.cz/UJOP-371.html?ujopcmsid=8:zkouska-z-ralii-a-cestiny-pro-obcanstvi-cr`
        );
        await sendTelegramMessage(
            CHAT_ID_3 , `\n${cityName}\n for term ${label} is bookable,\n hurry up to https://ujop.cuni.cz/UJOP-371.html?ujopcmsid=8:zkouska-z-ralii-a-cestiny-pro-obcanstvi-cr`
        );
    }
};

// Simplify runTest to run the test once without retry logic
async function runTest(context: ChromiumBrowserContext, city: string, cityName: string) {
    let page;
    try {
        page = await context.newPage();
        await checkTermForCity(page, city, cityName);
    } finally {
        if (page) {
            await page.close().catch(e => console.error('Error closing page:', e));
        }
    }
}

async function runTestWithContextRestart(
    context: ChromiumBrowserContext,
    city: string,
    cityName: string,
    chromiumInstance: typeof chromium,
    maxRetries = 2
) {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            await runTest(context, city, cityName);
            break; // If successful, exit the loop
        } catch (error) {
            console.error(`Attempt ${attempts + 1} failed:`, error);
            attempts++;

            if (error.message.includes("close")) {
                console.log("Context closed. Recreating context...");
                try {
                    context = await chromiumInstance.launchPersistentContext('', {
                        headless: false,
                        ignoreDefaultArgs: ['--hide-scrollbars', '--mute-audio'],
                        env: {
                            ...process.env,
                            DISPLAY: process.env.DISPLAY || ':99.0',
                        },
                    });
                } catch (contextError) {
                    console.error("Failed to recreate context:", contextError);
                }
            }

            if (attempts >= maxRetries) {
                throw new Error(`Max retries (${maxRetries}) reached. Test failed.`);
            }

            // Add a small delay between attempts
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    return context; // Return the potentially new context
}


// Modify each test to use a shared browser context
test.describe('Booking slot checks', () => {
    let context: ChromiumBrowserContext;

    test.beforeAll(async () => {
        context = await chromium.launchPersistentContext('', {
            headless: false, // Run in headed mode
            ignoreDefaultArgs: ['--hide-scrollbars', '--mute-audio'],
            env: {
                ...process.env,
                DISPLAY: process.env.DISPLAY || ':99.0', // Set DISPLAY for Xvfb in CI
            },
        });
    });

    test.afterAll(async () => {
        if (context) {
          await context.close().catch(e => console.error('Error closing context:', e));
        }
    });
    
    test("check if there is a bookable slot Praha-Krystal", async () => {
    context = await runTestWithContextRestart(context, "Praha-Krystal", 'Praha-Krystal', chromium);
    });

    test("check if there is a bookable slot Praha-Voršilská", async () => {
    context = await runTestWithContextRestart(context, "Praha-Vor%C5%A1ilsk%C3%A1", 'Praha-Vorsilska', chromium);
    });

    test("check if there is a bookable slot Podebrady", async () => {
    context = await runTestWithContextRestart(context, "Pod%C4%9Bbrady", 'Podebrady', chromium);
    });

    test("check if there is a bookable slot České Budějovice", async () => {
    context = await runTestWithContextRestart(context, "%C4%8Cesk%C3%A9%20Bud%C4%9Bjovice", 'Ceské Budějovice', chromium);
    });
});
