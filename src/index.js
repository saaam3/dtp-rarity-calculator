const fs = require("fs-extra");
const path = require("path");

const metadata = fs
   .readFileSync(path.join(process.cwd(), "trash_pandas.txt"))
   .toString();

let pandaMetadatas = metadata.split("\n").reduce((acc, value) => {
   acc.push(JSON.parse(value));
   return acc;
}, []);

const traitMap = {};
// step 1, retrieve trait shape
const traits = pandaMetadatas.reduce((acc, value) => {
   const { attributes } = value;

   attributes.forEach((attr) => {
      if (!acc.includes(attr.trait_type)) {
         acc.push(attr.trait_type);
      }
   });

   return acc;
}, []);

console.log(`Loaded ${pandaMetadatas.length} trash pandas`);
console.log(`Loaded ${traits.length} traits`);

//step 2, inject null values for missing traits
pandaMetadatas = pandaMetadatas.map((metadata) => {
   const pandaTraitTypes = metadata.attributes.map((attr) => attr.trait_type);

   traits.forEach((trait) => {
      // if current panda attributes does not have the current trait iterated, add the non existent trait to the panda metadata and set the value to null
      if (!pandaTraitTypes.includes(trait)) {
         metadata.attributes.push({
            trait_type: trait,
            value: null,
         });
      }
   });

   const { attributes } = metadata;

   // step 3 build traitmap which includes the traits as well as the number of occurences for each value of the trait
   attributes.forEach((attr) => {
      if (!(attr.trait_type in traitMap)) {
         traitMap[attr.trait_type] = {};
      }

      // we add a little space on the key so that we can add null key values
      if (!traitMap[attr.trait_type]?.[`${attr.value} `]) {
         traitMap[attr.trait_type] = {
            ...traitMap[attr.trait_type],
            [`${attr.value} `]: {
               count: 0,
               rarity: 0,
            },
         };
      }

      const traitData = traitMap[attr.trait_type][`${attr.value} `];
      traitData.count++;
      traitData.rarity = (traitData.count / pandaMetadatas.length).toPrecision(
         20
      );
   });

   return metadata;
});

// step 4, determine rank and sort
const ranks = pandaMetadatas
   .map(({ attributes, name, image }) => {
      const statisticalRank = attributes.reduce((acc, attr, index) => {
         const rarityPercent =
            traitMap[attr.trait_type][`${attr.value} `].rarity;
         return index ? acc * rarityPercent : rarityPercent;
      }, 0);

      return {
         name,
         image,
         statisticalRank,
      };
   })
   .sort((a, b) => a.statisticalRank - b.statisticalRank)
   .map((entry, index) => {
      return {
         rank: index + 1,
         ...entry,
      };
   });

const files = {
   dtp_ranks_moonrank: {
      contents: ranks
         .map((entry) => `Rank #${entry.rank}: ${entry.name}`)
         .join("\n"),
      extension: "txt",
   },
   dtp_ranks_moonrank_json: {
      contents: JSON.stringify(ranks),
      extension: "json",
   },
};

Object.keys(files).forEach((key) => {
   const fileData = files[key];
   fs.writeFileSync(
      path.join(process.cwd(), `${key}.${fileData.extension}`),
      fileData.contents
   );
});
