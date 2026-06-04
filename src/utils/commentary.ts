// Slang lists for gully cricket commentary
const OUT_MESSAGES = [
  "Oh no! OUT! That's a massive blow!",
  "Bowled! The stumps are flying! What a ball!",
  "Caught! A simple catch in the street!",
  "Gone! The batsman is walking back to the concrete!",
  "Wicket down! Gully bowler celebrates like he's in the IPL!"
];

const GHAR_KE_BAAHAR_OUT = [
  "Ghar ke baahar out! Hit it onto the terrace! You have to go fetch the ball now!",
  "Oh no! Over the neighbor's wall! Legend says the neighbor won't give the ball back. You are OUT!",
  "Out! Bro hit it into the aunty's balcony! Instant disqualification!"
];

const ONE_PITCH_OUT = [
  "One pitch catch out! That's the legendary gully cricket rule!",
  "Caught on one bounce! In the streets, that is OUT! Golden hand!",
  "One tip catch is out! Pack your bats, my friend."
];

const SIX_MESSAGES = [
  "That is massive! Six runs over the bike parking!",
  "What a shot! Out of the gully! Hope it didn't break any window glass!",
  "Huge hit! Helicopter shot in the streets! Six runs!",
  "Boom! Into the stratosphere! That is a monstrous six!"
];

const FOUR_MESSAGES = [
  "Four runs! Hit right through the narrow street gap!",
  "Boundary! Directly clicked against the staircase wall!",
  "Sublime timing! Under the parked scooter for four runs!",
  "Four! The fielders can only run and chase it past the drain!"
];

const DOT_MESSAGES = [
  "No run. Solid defense on the pothole.",
  "Dot ball. Excellent tight bowling underarm.",
  "Inswinging street special, dot ball.",
  "Beaten! Beautiful change of pace."
];

const WIDE_MESSAGES = [
  "Wide ball! Street bowling at its widest!",
  "Wide! Extra run. Bowler needs to aim between the two bricks!",
  "Wide ball! That was practically in the next block!"
];

const NO_BALL_MESSAGES = [
  "No ball! Bowler overstepped on the chalk line!",
  "No ball! High full toss, danger ball! Extra run and free hit coming up!"
];

function getRandomItem(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateCommentary(
  ballNumber: string, // e.g. "Over 1.3"
  batsmanName: string,
  runs: number,
  isWicket: boolean,
  wicketType?: string,
  extraType?: 'wide' | 'noball' | 'bye' | 'legbye',
  extras?: number
): { text: string; phrase: string } {
  let text = `${ballNumber}: `;
  let phrase = "";

  if (isWicket) {
    if (wicketType === 'hit_out_of_ground') {
      phrase = getRandomItem(GHAR_KE_BAAHAR_OUT);
    } else if (wicketType === 'one_pitch') {
      phrase = getRandomItem(ONE_PITCH_OUT);
    } else {
      phrase = `${batsmanName} is OUT! ${getRandomItem(OUT_MESSAGES)}`;
    }
  } else if (extraType === 'wide') {
    phrase = `${getRandomItem(WIDE_MESSAGES)} (+${extras || 1} run)`;
  } else if (extraType === 'noball') {
    phrase = `${getRandomItem(NO_BALL_MESSAGES)} (+${extras || 1} run)`;
  } else if (runs === 6) {
    phrase = `${batsmanName} hits it! ${getRandomItem(SIX_MESSAGES)}`;
  } else if (runs === 4) {
    phrase = `${batsmanName} find the gap! ${getRandomItem(FOUR_MESSAGES)}`;
  } else if (runs > 0) {
    phrase = `${batsmanName} runs hard for ${runs} ${runs === 1 ? 'run' : 'runs'}. Good hustle on the asphalt!`;
  } else {
    phrase = `${batsmanName} plays it. ${getRandomItem(DOT_MESSAGES)}`;
  }

  text += phrase;
  return { text, phrase };
}

export function speakText(text: string) {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Cancel ongoing speech
      try {
        window.speechSynthesis.cancel();
      } catch (cancelErr) {
        console.warn("speechSynthesis.cancel failed:", cancelErr);
      }
      
      // Quick timeout to ensure cancellation registers
      setTimeout(() => {
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.pitch = 1.1; // Slightly higher pitch for exciting sports commentary
          utterance.rate = 1.05; // Quick speaking pace
          
          // Select an English voice
          const voices = window.speechSynthesis.getVoices() || [];
          // Try to find a nice vocal profile or default
          const engVoice = voices.find(v => v.lang.startsWith('en-'));
          if (engVoice) {
            utterance.voice = engVoice;
          }
          
          window.speechSynthesis.speak(utterance);
        } catch (innerErr) {
          console.warn("speechSynthesis.speak execution failed:", innerErr);
        }
      }, 50);
    }
  } catch (err) {
    console.warn("speakText failed entirely:", err);
  }
}
