/** Fixed hint expectations, checked against unique solutions and published examples. */
export const HINT_FIXTURES = [
  {
    id: "fh01",
    source: "https://hodoku.sourceforge.net/en/show_example.php?file=fh01",
    puzzle:
      "800739006370465000040182009000600040054300610060500000400853070000271064100940002",
    technique: "full-house",
    cells: [77],
    eliminations: [],
    placement: {
      index: 77,
      digit: 6,
    },
    chain: [
      {
        technique: "full-house",
        cells: [77],
        eliminations: [],
        placement: {
          index: 77,
          digit: 6,
        },
      },
    ],
  },
  {
    id: "n101",
    source: "https://hodoku.sourceforge.net/en/show_example.php?file=n101",
    puzzle:
      "412736589000000106568010370000850210100000008087090000030070865800000000000908401",
    technique: "naked-single",
    cells: [51],
    eliminations: [],
    placement: {
      index: 51,
      digit: 6,
    },
    chain: [
      {
        technique: "naked-single",
        cells: [51],
        eliminations: [],
        placement: {
          index: 51,
          digit: 6,
        },
      },
    ],
  },
  {
    id: "h101",
    source: "https://hodoku.sourceforge.net/en/show_example.php?file=h101",
    puzzle:
      "028007000016083070000020851137290000000730000000046307290070000000860140000300700",
    technique: "hidden-single",
    cells: [21],
    eliminations: [],
    placement: {
      index: 21,
      digit: 6,
    },
    chain: [
      {
        technique: "hidden-single",
        cells: [21],
        eliminations: [],
        placement: {
          index: 21,
          digit: 6,
        },
      },
    ],
  },
  {
    id: "n201",
    source: "https://hodoku.sourceforge.net/en/show_example.php?file=n201",
    puzzle:
      "700849030928135006400267089642783951397451628815692300204516093100008060500004010",
    technique: "naked-pair",
    cells: [64, 65, 66],
    eliminations: [
      {
        index: 64,
        digit: 3,
      },
    ],
    placement: {
      index: 64,
      digit: 7,
    },
    chain: [
      {
        technique: "naked-pair",
        cells: [65, 66],
        eliminations: [
          {
            index: 64,
            digit: 3,
          },
        ],
        placement: null,
      },
      {
        technique: "naked-single",
        cells: [64],
        eliminations: [],
        placement: {
          index: 64,
          digit: 7,
        },
      },
    ],
  },
  {
    id: "h201",
    source: "https://hodoku.sourceforge.net/en/show_example.php?file=h201",
    puzzle:
      "049132000081479000327685914096051800075028000038046005853267000712894563964513000",
    technique: "hidden-pair",
    cells: [42, 44, 62],
    eliminations: [
      {
        index: 44,
        digit: 6,
      },
    ],
    placement: {
      index: 42,
      digit: 6,
    },
    chain: [
      {
        technique: "hidden-pair",
        cells: [44, 62],
        eliminations: [
          {
            index: 44,
            digit: 6,
          },
        ],
        placement: null,
      },
      {
        technique: "hidden-single",
        cells: [42],
        eliminations: [],
        placement: {
          index: 42,
          digit: 6,
        },
      },
    ],
  },
  {
    id: "lc101",
    source: "https://hodoku.sourceforge.net/en/show_example.php?file=lc101",
    puzzle:
      "984000000002500040001904002006097230003602000209035610195768423427351896638009751",
    technique: "pointing",
    cells: [18, 19, 24],
    eliminations: [
      {
        index: 24,
        digit: 5,
      },
    ],
    placement: {
      index: 24,
      digit: 3,
    },
    chain: [
      {
        technique: "pointing",
        cells: [18, 19],
        eliminations: [
          {
            index: 24,
            digit: 5,
          },
        ],
        placement: null,
      },
      {
        technique: "naked-single",
        cells: [24],
        eliminations: [],
        placement: {
          index: 24,
          digit: 3,
        },
      },
    ],
  },
  {
    id: "lc201",
    source: "https://hodoku.sourceforge.net/en/show_example.php?file=lc201",
    puzzle:
      "318005406000603810006080503864952137123476958795318264030500780000007305000039641",
    technique: "claiming",
    cells: [10, 11, 19],
    eliminations: [
      {
        index: 19,
        digit: 7,
      },
    ],
    placement: {
      index: 19,
      digit: 4,
    },
    chain: [
      {
        technique: "claiming",
        cells: [10, 11],
        eliminations: [
          {
            index: 19,
            digit: 7,
          },
        ],
        placement: null,
      },
      {
        technique: "naked-single",
        cells: [19],
        eliminations: [],
        placement: {
          index: 19,
          digit: 4,
        },
      },
    ],
  },
  {
    id: "h301",
    source: "https://hodoku.sourceforge.net/en/show_example.php?file=h301",
    puzzle:
      "280000473534827196071034080300500040000340060460790310090203654003009821000080937",
    technique: "hidden-triple",
    cells: [2, 64, 73, 74],
    eliminations: [
      {
        index: 73,
        digit: 1,
      },
      {
        index: 74,
        digit: 6,
      },
    ],
    placement: {
      index: 2,
      digit: 6,
    },
    chain: [
      {
        technique: "hidden-triple",
        cells: [64, 73, 74],
        eliminations: [
          {
            index: 73,
            digit: 1,
          },
          {
            index: 74,
            digit: 6,
          },
        ],
        placement: null,
      },
      {
        technique: "hidden-single",
        cells: [2],
        eliminations: [],
        placement: {
          index: 2,
          digit: 6,
        },
      },
    ],
  },
  {
    id: "bf201",
    source: "https://hodoku.sourceforge.net/en/show_example.php?file=bf201",
    puzzle:
      "041729030769003402032640719403900170607004903195370024214567398376090541958431267",
    technique: "x-wing",
    cells: [13, 16, 31, 40, 43],
    eliminations: [
      {
        index: 31,
        digit: 5,
      },
    ],
    placement: {
      index: 31,
      digit: 8,
    },
    chain: [
      {
        technique: "x-wing",
        cells: [13, 16, 40, 43],
        eliminations: [
          {
            index: 31,
            digit: 5,
          },
        ],
        placement: null,
      },
      {
        technique: "naked-single",
        cells: [31],
        eliminations: [],
        placement: {
          index: 31,
          digit: 8,
        },
      },
    ],
  },
  {
    id: "bf301",
    source: "https://hodoku.sourceforge.net/en/show_example.php?file=bf301",
    puzzle:
      "160543070078601435435807601720458069600912057000376004016030040300080016007164503",
    technique: "swordfish",
    cells: [9, 13, 22, 25, 52, 72, 79],
    eliminations: [
      {
        index: 52,
        digit: 2,
      },
      {
        index: 54,
        digit: 2,
      },
    ],
    placement: {
      index: 52,
      digit: 8,
    },
    chain: [
      {
        technique: "swordfish",
        cells: [9, 13, 22, 25, 72, 79],
        eliminations: [
          {
            index: 52,
            digit: 2,
          },
          {
            index: 54,
            digit: 2,
          },
        ],
        placement: null,
      },
      {
        technique: "naked-single",
        cells: [52],
        eliminations: [],
        placement: {
          index: 52,
          digit: 8,
        },
      },
    ],
  },
  {
    id: "xy01",
    source: "https://hodoku.sourceforge.net/en/show_example.php?file=xy01",
    puzzle:
      "800360900009010863063089005924673158386951724571824396432196587698537000000248639",
    technique: "xy-wing",
    cells: [2, 5, 9, 14],
    eliminations: [
      {
        index: 14,
        digit: 2,
      },
    ],
    placement: {
      index: 14,
      digit: 5,
    },
    chain: [
      {
        technique: "xy-wing",
        cells: [2, 5, 9],
        eliminations: [
          {
            index: 14,
            digit: 2,
          },
        ],
        placement: null,
      },
      {
        technique: "naked-single",
        cells: [14],
        eliminations: [],
        placement: {
          index: 14,
          digit: 5,
        },
      },
    ],
  },
  {
    id: "xyz01",
    source: "https://hodoku.sourceforge.net/en/show_example.php?file=xyz01",
    puzzle:
      "869453721000921568215800439621534987407610352000200146000102803932785614100340205",
    technique: "xyz-wing",
    cells: [10, 54, 55, 73],
    eliminations: [
      {
        index: 73,
        digit: 7,
      },
    ],
    placement: {
      index: 73,
      digit: 8,
    },
    chain: [
      {
        technique: "xyz-wing",
        cells: [10, 54, 55],
        eliminations: [
          {
            index: 73,
            digit: 7,
          },
        ],
        placement: null,
      },
      {
        technique: "naked-single",
        cells: [73],
        eliminations: [],
        placement: {
          index: 73,
          digit: 8,
        },
      },
    ],
  },
  {
    id: "sk01",
    source: "https://hodoku.sourceforge.net/en/show_example.php?file=sk01",
    puzzle:
      "697000002001972063003006790912000607374260950865709024148693275709024006006807009",
    technique: "skyscraper",
    cells: [5, 26, 41, 44],
    eliminations: [
      {
        index: 6,
        digit: 1,
      },
      {
        index: 7,
        digit: 1,
      },
      {
        index: 21,
        digit: 1,
      },
      {
        index: 22,
        digit: 1,
      },
    ],
    placement: {
      index: 26,
      digit: 1,
    },
    chain: [
      {
        technique: "skyscraper",
        cells: [5, 26, 41, 44],
        eliminations: [
          {
            index: 6,
            digit: 1,
          },
          {
            index: 7,
            digit: 1,
          },
          {
            index: 21,
            digit: 1,
          },
          {
            index: 22,
            digit: 1,
          },
        ],
        placement: null,
      },
      {
        technique: "hidden-single",
        cells: [26],
        eliminations: [],
        placement: {
          index: 26,
          digit: 1,
        },
      },
    ],
  },
  {
    id: "triple-158",
    source:
      "Generated by src/engine/tools/find-triple-fixture.mjs, seed triple:158",
    puzzle:
      "004700652000561483365284971008470206000020805000800347000952768002647139976008524",
    technique: "naked-triple",
    cells: [0, 27, 54, 63],
    eliminations: [
      {
        index: 36,
        digit: 1,
      },
      {
        index: 45,
        digit: 1,
      },
      {
        index: 45,
        digit: 5,
      },
      {
        index: 54,
        digit: 1,
      },
    ],
    placement: {
      index: 54,
      digit: 4,
    },
    chain: [
      {
        technique: "naked-triple",
        cells: [0, 27, 63],
        eliminations: [
          {
            index: 36,
            digit: 1,
          },
          {
            index: 45,
            digit: 1,
          },
          {
            index: 45,
            digit: 5,
          },
          {
            index: 54,
            digit: 1,
          },
        ],
        placement: null,
      },
      {
        technique: "naked-single",
        cells: [54],
        eliminations: [],
        placement: {
          index: 54,
          digit: 4,
        },
      },
    ],
  },
  {
    id: "bf302",
    source: "https://hodoku.sourceforge.net/en/show_example.php?file=bf302",
    puzzle:
      "108500234500302178000800569800605793005900481300008652980206310000000800000780900",
    technique: "swordfish",
    cells: [10, 11, 13, 28, 29, 31, 48, 56, 58],
    eliminations: [
      {
        index: 19,
        digit: 4,
      },
      {
        index: 20,
        digit: 4,
      },
      {
        index: 22,
        digit: 4,
      },
      {
        index: 46,
        digit: 4,
      },
      {
        index: 47,
        digit: 4,
      },
      {
        index: 49,
        digit: 4,
      },
      {
        index: 64,
        digit: 4,
      },
      {
        index: 65,
        digit: 4,
      },
      {
        index: 67,
        digit: 4,
      },
      {
        index: 73,
        digit: 4,
      },
      {
        index: 74,
        digit: 4,
      },
    ],
    placement: {
      index: 48,
      digit: 4,
    },
    chain: [
      {
        technique: "swordfish",
        cells: [10, 11, 13, 28, 29, 31, 56, 58],
        eliminations: [
          {
            index: 19,
            digit: 4,
          },
          {
            index: 20,
            digit: 4,
          },
          {
            index: 22,
            digit: 4,
          },
          {
            index: 46,
            digit: 4,
          },
          {
            index: 47,
            digit: 4,
          },
          {
            index: 49,
            digit: 4,
          },
          {
            index: 64,
            digit: 4,
          },
          {
            index: 65,
            digit: 4,
          },
          {
            index: 67,
            digit: 4,
          },
          {
            index: 73,
            digit: 4,
          },
          {
            index: 74,
            digit: 4,
          },
        ],
        placement: null,
      },
      {
        technique: "hidden-single",
        cells: [48],
        eliminations: [],
        placement: {
          index: 48,
          digit: 4,
        },
      },
    ],
  },
  {
    id: "xyz02",
    source: "https://hodoku.sourceforge.net/en/show_example.php?file=xyz02",
    puzzle:
      "673080209514092003982000005167359002809010536005800791006140928001008354008000167",
    technique: "xyz-wing",
    cells: [12, 21, 24, 50],
    eliminations: [
      {
        index: 22,
        digit: 6,
      },
      {
        index: 23,
        digit: 6,
      },
    ],
    placement: {
      index: 50,
      digit: 6,
    },
    chain: [
      {
        technique: "xyz-wing",
        cells: [12, 21, 24],
        eliminations: [
          {
            index: 22,
            digit: 6,
          },
          {
            index: 23,
            digit: 6,
          },
        ],
        placement: null,
      },
      {
        technique: "hidden-single",
        cells: [50],
        eliminations: [],
        placement: {
          index: 50,
          digit: 6,
        },
      },
    ],
  },
  {
    id: "h302",
    source: "https://hodoku.sourceforge.net/en/show_example.php?file=h302",
    puzzle:
      "500620037004890000000050000930000000020000605700000003000009000000000700680570002",
    technique: "hidden-triple",
    cells: [32, 41, 50, 68],
    eliminations: [
      {
        index: 32,
        digit: 1,
      },
      {
        index: 32,
        digit: 4,
      },
      {
        index: 32,
        digit: 7,
      },
      {
        index: 32,
        digit: 8,
      },
      {
        index: 50,
        digit: 1,
      },
      {
        index: 50,
        digit: 4,
      },
      {
        index: 50,
        digit: 8,
      },
      {
        index: 68,
        digit: 1,
      },
      {
        index: 68,
        digit: 3,
      },
      {
        index: 68,
        digit: 4,
      },
      {
        index: 68,
        digit: 8,
      },
    ],
    placement: {
      index: 41,
      digit: 8,
    },
    chain: [
      {
        technique: "hidden-triple",
        cells: [32, 50, 68],
        eliminations: [
          {
            index: 32,
            digit: 1,
          },
          {
            index: 32,
            digit: 4,
          },
          {
            index: 32,
            digit: 7,
          },
          {
            index: 32,
            digit: 8,
          },
          {
            index: 50,
            digit: 1,
          },
          {
            index: 50,
            digit: 4,
          },
          {
            index: 50,
            digit: 8,
          },
          {
            index: 68,
            digit: 1,
          },
          {
            index: 68,
            digit: 3,
          },
          {
            index: 68,
            digit: 4,
          },
          {
            index: 68,
            digit: 8,
          },
        ],
        placement: null,
      },
      {
        technique: "hidden-single",
        cells: [41],
        eliminations: [],
        placement: {
          index: 41,
          digit: 8,
        },
      },
    ],
  },
  {
    id: "exemplars-116",
    source:
      "https://hodoku.sourceforge.net/libraries/exemplars-1.0.txt (line 116, s n3(8) s; position after singles)",
    original:
      "000080057060379000020000000000700000000004596032900040006450320000000000000000008",
    puzzle:
      "000082057065379204020540003600715832000234596532968741006450329000800005050000008",
    technique: "naked-triple",
    cells: [9, 18, 36, 54],
    eliminations: [
      {
        index: 0,
        digit: 1,
      },
      {
        index: 18,
        digit: 1,
      },
      {
        index: 18,
        digit: 7,
      },
      {
        index: 18,
        digit: 8,
      },
      {
        index: 63,
        digit: 1,
      },
      {
        index: 63,
        digit: 7,
      },
      {
        index: 72,
        digit: 1,
      },
      {
        index: 72,
        digit: 7,
      },
    ],
    placement: {
      index: 18,
      digit: 9,
    },
    chain: [
      {
        technique: "naked-triple",
        cells: [9, 36, 54],
        eliminations: [
          {
            index: 0,
            digit: 1,
          },
          {
            index: 18,
            digit: 1,
          },
          {
            index: 18,
            digit: 7,
          },
          {
            index: 18,
            digit: 8,
          },
          {
            index: 63,
            digit: 1,
          },
          {
            index: 63,
            digit: 7,
          },
          {
            index: 72,
            digit: 1,
          },
          {
            index: 72,
            digit: 7,
          },
        ],
        placement: null,
      },
      {
        technique: "naked-single",
        cells: [18],
        eliminations: [],
        placement: {
          index: 18,
          digit: 9,
        },
      },
    ],
  },
  {
    id: "exemplars-117",
    source:
      "https://hodoku.sourceforge.net/libraries/exemplars-1.0.txt (line 117, s n3(8) s; position after singles)",
    original:
      "001900058060000000203000400800000065900635040000002000630001000105376000000040000",
    puzzle:
      "471903058560004000203000400800000365917635842356482000630001000105376000700040000",
    technique: "naked-triple",
    cells: [73, 74, 75, 77],
    eliminations: [
      {
        index: 75,
        digit: 2,
      },
      {
        index: 75,
        digit: 8,
      },
      {
        index: 78,
        digit: 2,
      },
      {
        index: 78,
        digit: 9,
      },
      {
        index: 79,
        digit: 2,
      },
      {
        index: 79,
        digit: 8,
      },
      {
        index: 79,
        digit: 9,
      },
      {
        index: 80,
        digit: 9,
      },
    ],
    placement: {
      index: 75,
      digit: 5,
    },
    chain: [
      {
        technique: "naked-triple",
        cells: [73, 74, 77],
        eliminations: [
          {
            index: 75,
            digit: 2,
          },
          {
            index: 75,
            digit: 8,
          },
          {
            index: 78,
            digit: 2,
          },
          {
            index: 78,
            digit: 9,
          },
          {
            index: 79,
            digit: 2,
          },
          {
            index: 79,
            digit: 8,
          },
          {
            index: 79,
            digit: 9,
          },
          {
            index: 80,
            digit: 9,
          },
        ],
        placement: null,
      },
      {
        technique: "naked-single",
        cells: [75],
        eliminations: [],
        placement: {
          index: 75,
          digit: 5,
        },
      },
    ],
  },
];
