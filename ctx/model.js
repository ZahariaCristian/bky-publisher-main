const dotenv = require('dotenv');
const Sequelize = require("sequelize"); //https://sequelize.org/v3/docs/querying/

dotenv.config();

//hasMany -> foreignKey, proprietà presente in destinazione -> sourceKey
//belongsTo -> foreignKey, proprietà presente in tabella verso -> sourceKey
//hasOne -> foreignKey, proprietà presente in tabella di destinazione

console.log("DB CONNECTING WITH: ", {
    db: process.env.DATABASE,
    user: process.env.DBUSER,
    pass: process.env.DBPASS,
})

var model = new Sequelize(process.env.DATABASE, process.env.DBUSER, process.env.DBPASS, {
    host: process.env.HOST,
    port: process.env.PORTDB,
    dialect: 'mysql',
    pool: { max: 10, min: 2, idle: 10000 },
    logging: process.env.PROD === '1' ? false : console.log
});

const tblLogs = model.define('tblLogs', {
    id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV1
    },
    userId: {
        type: Sequelize.UUID,
        allowNull: true
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false
    },
    status: {
        type: Sequelize.STRING, // "success" or "failure"
        allowNull: false
    },
    userAgent: {
        type: Sequelize.STRING,
        allowNull: false
    },
    browser: {
        type: Sequelize.STRING,
        allowNull: true
    },
    device: {
        type: Sequelize.STRING,
        allowNull: true
    },
    ipAddress: {
        type: Sequelize.STRING,
        allowNull: true
    },
    message: {
        type: Sequelize.STRING,
        allowNull: true
    },
    timestamp: {
        type: Sequelize.DATE,
        allowNull: false
    }
}, {
    freezeTableName: true,
    timestamps: false
});

var tblUser = model.define('tblUser', {
    OID: {
        type: Sequelize.UUID,
        primaryKey: true,
        unique: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV1
    },
    userName: {
        type: Sequelize.STRING,
        allowNull: true
    },
    mail: {
        type: Sequelize.STRING,
        allowNull: true
    },
    storedPassword: {
        type: Sequelize.STRING,
        allowNull: true
    },
    password: {
        type: Sequelize.VIRTUAL,
        set: function (value) {
            this.setDataValue('password', value);
            this.setDataValue('storedPassword', value);
        },
        get: function () {
            return this.getDataValue('storedPassword');
        }
    },
    isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    forceChangePassword: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    firstTime: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    icon: {
        type: Sequelize.STRING,
        allowNull: true
    },
    annunci: {
        type: Sequelize.VIRTUAL
    },
    isMe: {
        type: Sequelize.VIRTUAL
    },
    GCRecord: {
        type: Sequelize.INTEGER,
        allowNull: true
    }
}, {
    freezeTableName: true,
    timestamps: false
});

//   tblUser.sync({force: true}).then(function () {
//     // Table created
//     return tblUser.create({
//         UserName: 'John',
//       Password: '12345678'
//     });
//   });

var tblGruppi = model.define("tblGruppi", {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
    },
    owner: {
        type: Sequelize.UUID,
        allowNull: true
    },
    bkUserName: {
        type: Sequelize.STRING,
        allowNull: true
    },
    bkPassword: {
        type: Sequelize.STRING,
        allowNull: true
    },
    bkCredit: {
        type: Sequelize.STRING,
        allowNull: true
    },
    GCRecord: {
        type: Sequelize.INTEGER,
        allowNull: true
    }
}, {
    freezeTableName: true
});

var tblPlatform = model.define("tblPlatform", {
    gruppi: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    platform: {
        type: Sequelize.ENUM(
            'incontriamoci',
            'amasens',
            'trovagnocca',
            'megaescort',
            'incontriescort',
            'bakeca',
            'bakecaincontrii'
        ),
        allowNull: false,
        defaultValue: 'bakeca'
    },
    username: {
        type: Sequelize.STRING(100),
        allowNull: false
    },
    password: {
        type: Sequelize.STRING(255),
        allowNull: false
    },
    credit: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    status: {
        type: Sequelize.ENUM(
            'active',
            'inactive',
            'suspended',
        ),
        allowNull: false,
        defaultValue: 'active'
    },
}, {
    freezeTableName: true,
    timestamps: true
});

// ===== Associations =====
tblPlatform.belongsTo(tblGruppi, { foreignKey: 'gruppi', targetKey: "id", onDelete: 'CASCADE' });
tblGruppi.hasMany(tblPlatform, { foreignKey: 'gruppi', sourceKey: "id" });

var tblMembriGruppo = model.define("tblMembriGruppo", {
    group: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    member: {
        type: Sequelize.UUID,
        allowNull: true
    },
    owner: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    GCRecord: {
        type: Sequelize.INTEGER,
        allowNull: true
    }
}, {
    freezeTableName: true,
    timestamps: true
});

tblGruppi.hasMany(tblMembriGruppo, {
    foreignKey: "group",
    sourceKey: "id"
});
tblMembriGruppo.belongsTo(tblGruppi, {
    foreignKey: "group",
    targetKey: "id"
});

tblMembriGruppo.belongsTo(tblUser, {
    foreignKey: "member",
    targetKey: "OID"
});
tblUser.hasOne(tblMembriGruppo, {
    as: "group",
    foreignKey: "member"
});

var tblDonne = model.define("tblDonne", {
    name: {
        type: Sequelize.STRING,
        allowNull: false,          // Disallow null values
        defaultValue: "Scheda senza nome"  // Set default value if name is not provided
    },
    city: {
        type: Sequelize.STRING,
        allowNull: true
    },
    years: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    phone: {
        type: Sequelize.STRING,
        allowNull: true
    },
    credit: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    isPhoneChecked: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    groupOwner: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    GCRecord: {
        type: Sequelize.INTEGER,
        allowNull: true
    }
}, {
    freezeTableName: true,
    timestamps: true
});

tblGruppi.hasMany(tblDonne, {
    foreignKey: "groupOwner",
    sourceKey: "id"
});
tblDonne.belongsTo(tblGruppi, {
    foreignKey: "groupOwner",
    targetKey: "id"
});

var tblGalleria = model.define("tblGalleria", {
    donna: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    src: {
        type: Sequelize.STRING,
        allowNull: true
    },
    origin: {
        type: Sequelize.STRING,
        allowNull: true
    },
    isHidden: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    applyPhone: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    crop: {
        type: Sequelize.STRING,
        allowNull: true
    },
    isCover: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    rotate: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    GCRecord: {
        type: Sequelize.INTEGER,
        allowNull: true
    }
}, {
    freezeTableName: true,
    timestamps: true
});

tblDonne.hasMany(tblGalleria, {
    foreignKey: "donna",
    sourceKey: "id"
});
tblGalleria.belongsTo(tblDonne, {
    foreignKey: "donna",
    targetKey: "id"
});

var tblAnnunci = model.define("tblAnnunci", {
    title: {
        type: Sequelize.STRING,
        allowNull: true
    },
    city: {
        type: Sequelize.STRING,
        allowNull: true
    },
    location: {
        type: Sequelize.STRING,
        allowNull: true
    },
    categorie: {
        type: Sequelize.STRING,
        allowNull: true
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    note: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    serviceAfricana: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceIndiana: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceAsiatica: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceAraba: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceLatina: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceCaucasica: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceItaliana: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceSNaturale: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceSRifatto: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceCBiondi: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceCMarroni: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceCNeri: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceCRossi: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceMagro: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceFormoso: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceCash: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceCreditCard: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    hourlyPrice: {
        type: Sequelize.STRING,
        allowNull: true
    },
    serviceOrale: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceNazionalita: {
        type: Sequelize.STRING,
        allowNull: true
    },
    serviceAnale: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceSadomaso: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceEsperienzaFidanzata: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceAttriciPorno: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceEiaculazioneSulCorpo: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceMassaggioErotico: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceMassaggioTantrico: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceFetish: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceBacioAllaFrancese: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceGiocoDiRuolo: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceTrio: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceSexting: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceVideoChiamata: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceUomini: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceDonne: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceCoppie: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceDisabili: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceACasa: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceEventiEFeste: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceAlbergoMotel: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceClubs: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    serviceVisitaADomicilio: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    donna: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    hasWhatapp: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    cost: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    payed: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    groupOwner: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    editedBy: {
        type: Sequelize.UUID,
        allowNull: true
    },
    phoneTmp: {
        type: Sequelize.STRING,
        allowNull: true
    },
    GCRecord: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    sono: {
        type: Sequelize.STRING,
        allowNull: true
    },
}, {
    freezeTableName: true,
    timestamps: true
});

tblDonne.hasMany(tblAnnunci, {
    foreignKey: "donna",
    sourceKey: "id"
});
tblAnnunci.belongsTo(tblDonne, {
    foreignKey: "donna",
    targetKey: "id"
});

tblGalleria.hasMany(tblAnnunci, {
    foreignKey: "previewPhoto",
    sourceKey: "id"
});
tblAnnunci.belongsTo(tblGalleria, {
    foreignKey: "previewPhoto",
    targetKey: "id"
});

tblGruppi.hasMany(tblAnnunci, {
    foreignKey: "groupOwner",
    sourceKey: "id"
});
tblAnnunci.belongsTo(tblGruppi, {
    foreignKey: "groupOwner",
    targetKey: "id"
});

tblUser.hasMany(tblAnnunci, {
    foreignKey: "editedBy",
    sourceKey: "OID"
});
tblAnnunci.belongsTo(tblUser, {
    foreignKey: "editedBy",
    targetKey: "OID"
});

var tblGalleriaAnnuncio = model.define("tblGalleriaAnnuncio", {
    galleria: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    schedulazione: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    isAnteprima: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    GCRecord: {
        type: Sequelize.INTEGER,
        allowNull: true
    }
}, {
    freezeTableName: true,
    timestamps: false
});

tblGalleria.hasMany(tblGalleriaAnnuncio, {
    foreignKey: "galleria",
    sourceKey: "id"
});
tblGalleriaAnnuncio.belongsTo(tblGalleria, {
    foreignKey: "galleria",
    targetKey: "id"
});

var tblSchedulazioni = model.define("tblSchedulazioni", {
    annuncio: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    data: {
        type: Sequelize.DATE,
        allowNull: true
    },
    dataString: {
        type: Sequelize.VIRTUAL,
        get: function () {
            if (this.data != undefined) {
                return `${this.data.getDate()}+${this.data.getMonth()}`;
            } else {
                return "";
            }
        }
    },
    deadline: {
        type: Sequelize.VIRTUAL,
        get: function () {
            var dead = new Date(this.data);
            switch (this.typeAnnuncio) {
                case "Free":
                    dead.setDate(dead.getDate() + 1);
                    break;
                case "1x1":
                    dead.setDate(dead.getDate() + 2);
                    break;
                case "1x3":
                    dead.setDate(dead.getDate() + 4);
                    break;
                case "1x7":
                    dead.setDate(dead.getDate() + 8);
                    break;
                case "10x1":
                    dead.setDate(dead.getDate() + 2);
                    break;
                case "10x3":
                    dead.setDate(dead.getDate() + 4);
                    break;
            }
            return dead;
        }
    },
    period: {
        type: Sequelize.STRING,
        allowNull: true
    },
    typeAnnuncio: {
        type: Sequelize.ENUM("Free", "1x1", "1x3", "1x7", "1x14", "1x28", "3x1", "3x3", "3x7", "3x14", "3x28", "10x1", "10x3"),
        allowNull: true
    },
    state: {
        type: Sequelize.ENUM("OK", "ALERT", "KO", "EDIT", "REPUBLISH", "CLOSE", "CLOSED", "DELETE", "DELETED", "BLOCKED"),
        allowNull: true
    },
    editedBy: {
        type: Sequelize.UUID,
        allowNull: true
    },
    time: {
        type: Sequelize.VIRTUAL
    },
    Anteprima: {
        type: Sequelize.VIRTUAL
    },
    hasPremium: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    hasHighlight: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    hasEtichetta: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    hasVideo: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    payed: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    remotePostID: {
        type: Sequelize.STRING,
        allowNull: true
    },
    urlBK: {
        type: Sequelize.STRING,
        allowNull: true
    },
    dateTimeTop: {
        type: Sequelize.STRING,
        allowNull: true
    },
    platform: {
        type: Sequelize.ENUM(
            'incontriamoci',
            'amasens',
            'trovagnocca',
            'megaescort',
            'incontriescort',
            'bakeca',
            'bakecaincontrii'
        ),
        allowNull: false,
        defaultValue: 'bakeca'
    },
    city: {
        type: Sequelize.STRING,
        allowNull: true
    },
    GCRecord: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
}, {
    freezeTableName: true,
    timestamps: true
});

tblUser.hasMany(tblSchedulazioni, {
    foreignKey: "editedBy",
    sourceKey: "OID"
});
tblSchedulazioni.belongsTo(tblUser, {
    foreignKey: "editedBy",
    targetKey: "OID"
});

tblSchedulazioni.hasMany(tblGalleriaAnnuncio, {
    foreignKey: "schedulazione",
    sourceKey: "id"
});
tblGalleriaAnnuncio.belongsTo(tblSchedulazioni, {
    foreignKey: "schedulazione",
    targetKey: "id"
});

tblAnnunci.hasMany(tblSchedulazioni, {
    foreignKey: "annuncio",
    sourceKey: "id"
});
tblSchedulazioni.belongsTo(tblAnnunci, {
    foreignKey: "annuncio",
    targetKey: "id"
});

var tblAvvisiImportanti = model.define("tblAvvisiImportanti", {
    user: {
        type: Sequelize.UUID,
        allowNull: true
    },
    text: {
        type: Sequelize.STRING,
        allowNull: true
    },
    link: {
        type: Sequelize.STRING,
        allowNull: true
    },
    GCRecord: {
        type: Sequelize.INTEGER,
        allowNull: true
    }
}, {
    freezeTableName: true
});

tblUser.hasMany(tblAvvisiImportanti, {
    foreignKey: "user",
    sourceKey: "OID"
});
tblAvvisiImportanti.belongsTo(tblUser, {
    foreignKey: "user",
    targetKey: "OID"
});

var tblComunicazioni = model.define("tblComunicazioni", {
    user: {
        type: Sequelize.UUID,
        allowNull: true
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    replyTo: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    GCRecord: {
        type: Sequelize.INTEGER,
        allowNull: true
    }
}, {
    freezeTableName: true,
    timestamps: true
});

tblComunicazioni.hasMany(tblComunicazioni, {
    foreignKey: "replyTo",
    sourceKey: "id"
});
tblComunicazioni.belongsTo(tblComunicazioni, {
    foreignKey: "replyTo",
    targetKey: "id"
});

tblUser.hasMany(tblComunicazioni, {
    foreignKey: "user",
    sourceKey: "OID"
});
tblComunicazioni.belongsTo(tblUser, {
    foreignKey: "user",
    targetKey: "OID"
});

var tblBlackList = model.define("tblBlackList", {
    text: {
        type: Sequelize.STRING,
        allowNull: true
    },
    typeMatch: {
        type: Sequelize.ENUM("Contiene", "Inizia per", "Uguale"),
        allowNull: true
    },
    target: {
        type: Sequelize.ENUM("Titolo", "Descrizione", "Titolo e Descrizione"),
        allowNull: true
    },
    GCRecord: {
        type: Sequelize.INTEGER,
        allowNull: true
    }
}, {
    freezeTableName: true
});

var tblInvitiGruppo = model.define("tblInvitiGruppo", {
    user: {
        type: Sequelize.UUID,
        allowNull: false
    },
    group: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    secret: {
        type: Sequelize.STRING,
        allowNull: true
    },
    GCRecord: {
        type: Sequelize.INTEGER,
        allowNull: true
    }
}, {
    freezeTableName: true
});

var tblContactVerifyBakeca = model.define("tblContactVerifyBakeca", {
    remoteID: {
        type: Sequelize.STRING,
        allowNull: false
    },
    action: {
        type: Sequelize.STRING,
        allowNull: false
    },
    status: {
        type: Sequelize.BOOLEAN,
        allowNull: false
    },
    approved: {
        type: Sequelize.BOOLEAN,
        allowNull: false
    },
    code: {
        type: Sequelize.STRING,
        allowNull: true
    },
    phone: {
        type: Sequelize.STRING,
        allowNull: false
    },
    city: {
        type: Sequelize.STRING,
        allowNull: false
    }
}, {
    freezeTableName: true
});

var tblListinoPrezzi = model.define("tblListinoPrezzi", {
    group: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    uscita: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    oneXone: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    oneXthree: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    oneXseven: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    tenXone: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    tenXthree: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
}, {
    freezeTableName: true,
    timestamps: false
});

tblGruppi.hasMany(tblListinoPrezzi, {
    foreignKey: "group",
    sourceKey: "id"
});
tblListinoPrezzi.belongsTo(tblGruppi, {
    foreignKey: "group",
    targetKey: "id"
});

var tblListinoPrezziSuper = model.define("tblListinoPrezziSuper", {
    group: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    typeSuper: {
        type: Sequelize.ENUM("SUPERTOP", "VIDEO"),
        allowNull: false
    },
    oneXone: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    oneXthree: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    oneXseven: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    tenXone: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    tenXthree: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
}, {
    freezeTableName: true,
    timestamps: false
});

tblGruppi.hasMany(tblListinoPrezziSuper, {
    foreignKey: "group",
    sourceKey: "id"
});
tblListinoPrezziSuper.belongsTo(tblGruppi, {
    foreignKey: "group",
    targetKey: "id"
});

var tblRole = model.define("tblRole", {
    id: {
        type: Sequelize.UUID,
        primaryKey: true,
        unique: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4
    },
    name: {
        type: Sequelize.STRING,
        allowNull: true
    },
    IsAdministrative: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    }
}, {
    freezeTableName: true,
    timestamps: false
});

var tblUserRole = model.define("tblUserRole", {
    id: {
        type: Sequelize.UUID,
        primaryKey: true,
        unique: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4
    },
    user: {
        type: Sequelize.UUID,
        allowNull: false
    },
    role: {
        type: Sequelize.UUID,
        allowNull: false
    }
}, {
    freezeTableName: true,
    timestamps: false
});

tblRole.hasMany(tblUserRole, {
    foreignKey: "role",
    sourceKey: "id"
});
tblUserRole.belongsTo(tblRole, {
    foreignKey: "role",
    targetKey: "id"
});

tblUser.hasMany(tblUserRole, {
    foreignKey: "user",
    sourceKey: "OID"
});
tblUserRole.belongsTo(tblUser, {
    foreignKey: "user",
    targetKey: "OID"
});

var tblNavigationPermission = model.define("tblNavigationPermission", {
    role: {
        type: Sequelize.UUID,
        allowNull: false
    },
    path: {
        type: Sequelize.STRING,
        allowNull: true
    },
    state: {
        type: Sequelize.BOOLEAN,
        allowNull: false
    }
}, {
    freezeTableName: true,
    timestamps: false
});

tblRole.hasMany(tblNavigationPermission, {
    foreignKey: "role",
    sourceKey: "id"
});
tblNavigationPermission.belongsTo(tblRole, {
    foreignKey: "role",
    targetKey: "id"
});

var tblStoricoPagamenti = model.define("tblStoricoPagamenti", {
    importo: {
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    donna: {
        type: Sequelize.INTEGER,
        allowNull: true
    }
}, {
    freezeTableName: true,
    timestamps: true
});

tblDonne.hasMany(tblStoricoPagamenti, {
    foreignKey: "donna",
    sourceKey: "id"
});
tblStoricoPagamenti.belongsTo(tblDonne, {
    foreignKey: "donna",
    targetKey: "id"
});

var newGCRecord = () => {
    return Math.floor(new Date().getTime() / 1000);
}

module.exports = {
    model,
    tblUser,
    tblDonne,
    tblGalleria,
    tblAnnunci,
    tblGalleriaAnnuncio,
    tblSchedulazioni,
    tblAvvisiImportanti,
    tblComunicazioni,
    tblBlackList,
    tblPlatform,
    tblGruppi,
    tblMembriGruppo,
    tblInvitiGruppo,
    tblContactVerifyBakeca,
    tblListinoPrezzi,
    tblListinoPrezziSuper,
    tblRole,
    tblUserRole,
    tblNavigationPermission,
    tblStoricoPagamenti,
    tblLogs,
    newGCRecord
};
