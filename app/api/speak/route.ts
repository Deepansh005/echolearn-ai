import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { text, gender } = await req.json();

        if (!text) {
            return NextResponse.json(
                { error: "Text is required" },
                { status: 400 }
            );
        }

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            console.error("ELEVENLABS_API_KEY is missing");
            return NextResponse.json(
                { error: "Server configuration error: Missing API Key" },
                { status: 500 }
            );
        }

        // Voice IDs based on user selection:
        // Male: Niraj (zgqefOY5FPQ3bB7OZTVR)
        // Female: Devi (MF4J4IDTRo0AxOO4dpFR)
        let voiceId = "zgqefOY5FPQ3bB7OZTVR"; // Default Male (Niraj)
        if (gender === "female") {
            voiceId = "MF4J4IDTRo0AxOO4dpFR"; // Female (Devi)
        }

        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

        const headers = {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
        };

        const body = JSON.stringify({
            text: text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
            },
        });

        const response = await fetch(url, {
            method: "POST",
            headers,
            body,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("ElevenLabs API Error:", errorText);
            return NextResponse.json(
                { error: "Failed to fetch audio", details: errorText },
                { status: response.status }
            );
        }

        const audioBuffer = await response.arrayBuffer();

        return new NextResponse(audioBuffer, {
            headers: {
                "Content-Type": "audio/mpeg",
            },
        });
    } catch (error) {
        console.error("Error generating speech:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
