// Collection seed, from the Pokémon list of 11/07/26.
// His list = the Gen 1-4 Pokémon he did NOT have. Anything unlisted in #1-#493 he owns (filed in his binder).
// Dot = still missing (want list). Checkmark = just got it, not filed yet (toFile list). Gens 5-9 (#494+) not covered yet.
// Castform (#351) is OWNED (he has the Snowy and Sunny form cards); the original printing is still to find. Keep it out of want.
// Format for upgrades: owned: { "<pokedex #>": { tier: "holo", card: "<card id>" } }   Tiers: basic, reverse, rare, holo, ultra, secret
// Bump "version" whenever this file changes so the page applies the new entries.
window.PK_SEED = {
  version: 3,
  ownedRange: [1, 493],   // everything in this range is owned at "basic", except the want list
  owned: {},
  toFile: [36, 49, 57, 62, 122, 136, 142, 176, 182, 191, 192, 204, 205, 208, 212, 213, 217, 229, 237, 249, 285, 286, 303, 308, 318, 321, 324, 327, 334, 337, 338, 348, 383, 401, 425, 430, 441, 443, 449, 450, 463, 468, 469, 472, 474, 479, 485, 492],   // checkmarks: owned, waiting to be filed
  want: [6, 34, 68, 141, 154, 157, 169, 172, 173, 174, 185, 186, 189, 196, 197, 198, 211, 216, 221, 222, 230, 235, 236, 248, 254, 257, 269, 275, 289, 292, 295, 302, 306, 311, 312, 313, 319, 329, 330, 336, 340, 346, 347, 354, 360, 362, 368, 369, 376, 377, 378, 379, 391, 398, 402, 407, 412, 413, 414, 417, 421, 423, 424, 426, 428, 432, 433, 438, 440, 442, 445, 446, 451, 455, 456, 457, 458, 460, 461, 464, 465, 470, 473, 475, 476, 478, 487, 489, 493]
};
(function (s) {
  var want = {}; s.want.forEach(function (d) { want[d] = 1; });
  for (var d = s.ownedRange[0]; d <= s.ownedRange[1]; d++) if (!want[d] && !s.owned[d]) s.owned[d] = 'basic';
})(window.PK_SEED);
