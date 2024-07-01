import { test, expect, Page, chromium, Browser } from "@playwright/test";

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
    await page.locator("#select_termin").selectOption(label).catch(async () => {
        label = "7.12.2024"
        return await page.locator("#select_termin").selectOption(label)
    });

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

async function runTest(browser: Browser, city: string, cityName: string, maxRetries = 10) {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            const page = await browser.newPage();
            await page.waitForTimeout(2000);
            await checkTermForCity(page, city, cityName);
            await page.close();
            break; // If successful, exit the loop
        } catch (error) {
            console.error(`Attempt ${attempts + 1} failed:`, error);
            attempts++;
            if (attempts >= maxRetries) {
                throw new Error(
                    `Max retries (${maxRetries}) reached. Test failed.`
                );
            }
            // Check if the browser is closed and reopen if necessary
            if (!browser.isConnected()) {
                console.log("Browser disconnected. Reopening...");
                browser = await chromium.launch();
            }
        }
    }
}

test("check if there is a bookable slot Praha-Krystal", async () => {
    const browser = await chromium.launch();
    try {
        await runTest(browser, "Praha-Krystal", 'Praha-Krystal');
    } finally {
        await browser.close();
    }
});

test("check if there is a bookable slot Praha-Voršilská", async () => {
    const browser = await chromium.launch();
    try {
        await runTest(browser, "Praha-Vor%C5%A1ilsk%C3%A1", 'Praha-Vorsilska');
    } finally {
        await browser.close();
    }
});

test("check if there is a bookable slot Podebrady", async () => {
    const browser = await chromium.launch();
    try {
        await runTest(browser, "Pod%C4%9Bbrady", 'Podebrady');
    } finally {
        await browser.close();
    }
});

test("check if there is a bookable slot České Budějovice", async () => {
    const browser = await chromium.launch();
    try {
        await runTest(browser, "%C4%8Cesk%C3%A9%20Bud%C4%9Bjovice", 'Ceské Budějovice');
    } finally {
        await browser.close();
    }
});
