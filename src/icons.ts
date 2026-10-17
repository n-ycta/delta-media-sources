import play from "@phosphor-icons/core/assets/regular/play.svg?raw";
import plus from "@phosphor-icons/core/assets/regular/plus.svg?raw";
import search from "@phosphor-icons/core/assets/regular/magnifying-glass.svg?raw";
import link from "@phosphor-icons/core/assets/regular/link.svg?raw";
import gear from "@phosphor-icons/core/assets/regular/gear-six.svg?raw";
import recent from "@phosphor-icons/core/assets/regular/clock-counter-clockwise.svg?raw";
import out from "@phosphor-icons/core/assets/regular/arrow-square-out.svg?raw";
import close from "@phosphor-icons/core/assets/regular/x.svg?raw";
import youtube from "@phosphor-icons/core/assets/regular/youtube-logo.svg?raw";
import soundcloud from "@phosphor-icons/core/assets/regular/soundcloud-logo.svg?raw";
import spotify from "@phosphor-icons/core/assets/regular/spotify-logo.svg?raw";
const all = { play, plus, search, link, gear, recent, out, close, youtube, soundcloud, spotify };
export const icon = (name: keyof typeof all) =>
  all[name].replace("<svg", '<svg aria-hidden="true" width="18" height="18" fill="currentColor"');
