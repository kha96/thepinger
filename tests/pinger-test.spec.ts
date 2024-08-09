import {
    test,
    expect,
    Page,
    chromium,
    ChromiumBrowserContext,
} from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const CHAT_ID_1 = process.env.CHAT_ID_1!;
const CHAT_ID_2 = process.env.CHAT_ID_2!;
const CHAT_ID_3 = process.env.CHAT_ID_3!;

const EXAM_TYPES = [
    "%C4%8Desk%C3%A9%20re%C3%A1lie%20%2B%20%C4%8Desk%C3%BD%20jazyk",
    "pouze%20%C4%8Desk%C3%BD%20jazyk",
    "pouze%20%C4%8Desk%C3%A9%20re%C3%A1lie",
];

async function sendTelegramMessage(chatID: string, message: string) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const params = {
        chat_id: chatID,
        text: `${new Date().toLocaleString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZone: "Europe/Prague",
        })} - ${message}`,
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

const checkTermForCity = async (
    page: Page,
    city: string,
    cityName: string,
    examType: string
) => {
    var label = "19.10.2024";
    await page.goto(
        "https://ujop.cuni.cz/UJOP-371.html?ujopcmsid=8:zkouska-z-ralii-a-cestiny-pro-obcanstvi-cr"
    );
    await page.locator("#select_misto_zkousky").selectOption(city);
    await page.locator("#select_cast_zkousky").selectOption(examType);

    const options = await page
        .locator("#select_termin option")
        .allTextContents();
    const datePattern = /^\d{2}\.\d{2}\.\d{4}$/;
    const validOptions = options.filter((option) => datePattern.test(option));
    for (const option of validOptions) {
        try {
            const terminIsEnabled = await page
                .locator("#select_termin")
                .isEnabled();
            if (!terminIsEnabled) {
                console.log("Termin select is disabled.");
                return;
            }
            await page.locator("#select_termin").selectOption(option);
            label = option; // Update label to the successfully selected option

            await page.waitForTimeout(3000);
            const response = await page
                .getByRole("button", { name: "Přihlásit" })
                .isEnabled();
            if (response) {
                for (const chatId of [CHAT_ID_1, CHAT_ID_2, CHAT_ID_3]) {
                    await sendTelegramMessage(
                        chatId,
                        `\n${cityName}\n for term ${label} is bookable,\nhurry up to https://ujop.cuni.cz/UJOP-371.html?ujopcmsid=8:zkouska-z-ralii-a-cestiny-pro-obcanstvi-cr`
                    );
                }
            }
        } catch {
            console.log(`Option ${option} is not available.`);
        }
    }
    if (!label) {
        console.log(`No available dates found for ${cityName}`);
        return; // Exit the function, effectively ending the test successfully
    }
};

test.describe.configure({ mode: "parallel" });

test.describe("Booking slot checks", () => {
    const cities = [
        { id: "Praha-Krystal", name: "Praha-Krystal" },
        { id: "Praha-Vor%C5%A1ilsk%C3%A1", name: "Praha-Vorsilska" },
        { id: "Pod%C4%9Bbrady", name: "Podebrady" },
        { id: "%C4%8Cesk%C3%A9%20Bud%C4%9Bjovice", name: "Ceské Budějovice" },
        { id: "Brno", name: "Brno" },
    ];

    for (const city of cities) {
        for (const examType of EXAM_TYPES) {
            test(`check if there is a bookable slot ${city.name} for ${examType}`, async ({
                page,
            }) => {
                await checkTermForCity(page, city.id, city.name, examType);
            });
        }
    }
});
