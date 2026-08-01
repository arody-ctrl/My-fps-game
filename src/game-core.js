/* =====================================================
   GAME CORE
   Pure, renderer independent game logic.
   Loaded in the browser as the global `GameCore`
   and importable in Node for unit tests.
===================================================== */

(function(root,factory){

    if(
        typeof module==="object"&&
        module.exports
    ){

        module.exports=factory();

    }
    else{

        root.GameCore=factory();

    }

})(
    typeof self!=="undefined"?self:this,
    function(){

/* =====================================================
   WEAPONS
===================================================== */

function createWeapons(){

    return {

        AR:{
            name:"ASSAULT RIFLE",
            magazineSize:30,
            ammo:30,
            reserve:120,
            damage:25,
            fireRate:120,
            projectileSpeed:110,
            projectileLife:5,
            spread:.008,
            adsFOV:55,
            normalFOV:75,
            automatic:true
        },

        SMG:{
            name:"SMG",
            magazineSize:35,
            ammo:35,
            reserve:175,
            damage:18,
            fireRate:70,
            projectileSpeed:95,
            projectileLife:4,
            spread:.025,
            adsFOV:60,
            normalFOV:75,
            automatic:true
        },

        PISTOL:{
            name:"PISTOL",
            magazineSize:12,
            ammo:12,
            reserve:72,
            damage:40,
            fireRate:250,
            projectileSpeed:100,
            projectileLife:5,
            spread:.01,
            adsFOV:58,
            normalFOV:75,
            automatic:false
        },

        SNIPER:{
            name:"SNIPER",
            magazineSize:5,
            ammo:5,
            reserve:30,
            damage:200,
            fireRate:1100,
            projectileSpeed:300,
            projectileLife:10,
            spread:0,
            adsFOV:18,
            normalFOV:75,
            automatic:false
        }

    };

}

/* =====================================================
   UPGRADES
===================================================== */

var MAX_UPGRADES=4;

var upgradeTypes=[

    {
        name:"DAMAGE +20%",
        type:"damage",
        apply:function(w){

            w.damage=Math.round(
                w.damage*1.2
            );

        }
    },

    {
        name:"FIRE RATE +15%",
        type:"fireRate",
        apply:function(w){

            w.fireRate=Math.max(
                35,
                Math.round(w.fireRate*.85)
            );

        }
    },

    {
        name:"MAGAZINE +25%",
        type:"magazine",
        apply:function(w){

            var oldSize=w.magazineSize;

            w.magazineSize=Math.ceil(
                w.magazineSize*1.25
            );

            w.ammo+=
                w.magazineSize-oldSize;

        }
    },

    {
        name:"RESERVE AMMO +50%",
        type:"reserve",
        apply:function(w){

            w.reserve+=Math.ceil(
                w.reserve*.5
            );

        }
    },

    {
        name:"PROJECTILE SPEED +25%",
        type:"speed",
        apply:function(w){

            w.projectileSpeed*=1.25;

        }
    },

    {
        name:"ACCURACY +30%",
        type:"accuracy",
        apply:function(w){

            w.spread*=.7;

        }
    }

];

/*
   Applies up to `count` distinct upgrades to a weapon
   while respecting MAX_UPGRADES.
   Returns the names of the applied upgrades.
*/

function applyUpgrades(
    weapon,
    count,
    random
){

    var rng=random||Math.random;

    var available=upgradeTypes.slice();

    var applied=[];

    for(var i=0;i<count;i++){

        if(available.length===0)break;

        var index=Math.floor(
            rng()*available.length
        );

        var upgrade=available.splice(
            index,
            1
        )[0];

        if(!weapon.upgrades){

            weapon.upgrades=[];

        }

        if(
            weapon.upgrades.length<
            MAX_UPGRADES
        ){

            upgrade.apply(weapon);

            weapon.upgrades.push(
                upgrade.type
            );

            applied.push(upgrade.name);

        }

    }

    return applied;

}

/* =====================================================
   COLLISION
===================================================== */

/*
   Wall shape:
   {
       position:{x,z},
       userData:{halfWidth,halfDepth}
   }
*/

function circleIntersectsWall(
    walls,
    x,
    z,
    radius
){

    for(var i=0;i<walls.length;i++){

        var wall=walls[i];

        var halfWidth=
            wall.userData.halfWidth;

        var halfDepth=
            wall.userData.halfDepth;

        var closestX=Math.max(
            wall.position.x-halfWidth,
            Math.min(
                x,
                wall.position.x+halfWidth
            )
        );

        var closestZ=Math.max(
            wall.position.z-halfDepth,
            Math.min(
                z,
                wall.position.z+halfDepth
            )
        );

        var dx=x-closestX;
        var dz=z-closestZ;

        if(
            dx*dx+dz*dz<
            radius*radius
        ){

            return true;

        }

    }

    return false;

}

/*
   Slides along walls by resolving each axis
   independently. Mutates `position`.
*/

function moveWithCollision(
    walls,
    position,
    movement,
    radius
){

    if(
        !circleIntersectsWall(
            walls,
            position.x+movement.x,
            position.z,
            radius
        )
    ){

        position.x+=movement.x;

    }

    if(
        !circleIntersectsWall(
            walls,
            position.x,
            position.z+movement.z,
            radius
        )
    ){

        position.z+=movement.z;

    }

    return position;

}

/*
   Finds an open spawn point for an airdrop,
   falling back to the map center.
*/

function randomAirdropPosition(
    walls,
    random,
    attempts
){

    var rng=random||Math.random;

    var tries=attempts||40;

    for(var i=0;i<tries;i++){

        var x=-100+rng()*200;
        var z=-100+rng()*200;

        if(
            !circleIntersectsWall(
                walls,
                x,
                z,
                2
            )
        ){

            return {
                x:x,
                z:z
            };

        }

    }

    return {
        x:0,
        z:0
    };

}

/* =====================================================
   WAVES
===================================================== */

function waveEnemyCount(wave){

    return 5+(wave-1)*2;

}

function waveBonus(wave){

    return wave*250;

}

/* =====================================================
   SCORING
===================================================== */

var LONG_SHOT_DISTANCE=75;

function killScore(
    weaponName,
    distance
){

    var points=
        weaponName==="SNIPER"?250:100;

    if(distance>LONG_SHOT_DISTANCE){

        points+=100;

    }

    return points;

}

/* =====================================================
   AMMO
===================================================== */

/*
   Moves rounds from the reserve into the magazine.
   Mutates `weapon` and returns the reloaded amount.
*/

function reloadWeapon(weapon){

    var needed=
        weapon.magazineSize-weapon.ammo;

    if(
        needed<=0||
        weapon.reserve<=0
    ){

        return 0;

    }

    var amount=Math.min(
        needed,
        weapon.reserve
    );

    weapon.ammo+=amount;
    weapon.reserve-=amount;

    return amount;

}

function canFire(
    weapon,
    weaponName,
    now,
    lastShot,
    isADS
){

    if(now-lastShot<weapon.fireRate){

        return false;

    }

    if(
        weaponName==="SNIPER"&&
        !isADS
    ){

        return false;

    }

    return weapon.ammo>0;

}

/* =====================================================
   AIRDROP PICKUP
===================================================== */

var AIRDROP_SCORE=500;

function airdropHealth(
    health,
    amount
){

    return Math.min(
        100,
        health+amount
    );

}

/*
   Restocks every weapon reserve by 50%-100%
   of its magazine size.
*/

function restockReserves(
    weapons,
    random
){

    var rng=random||Math.random;

    for(var key in weapons){

        var weapon=weapons[key];

        weapon.reserve+=Math.ceil(
            weapon.magazineSize*
            (.5+rng()*.5)
        );

    }

    return weapons;

}

/* =====================================================
   DAMAGE
===================================================== */

function applyDamage(
    health,
    damage
){

    return Math.max(
        0,
        health-damage
    );

}

/* =====================================================
   ADS
===================================================== */

/*
   Describes the view state for the given weapon
   while aiming down sights or hip firing.
*/

function adsView(
    weapon,
    weaponName,
    isADS
){

    var scoped=
        isADS&&
        weaponName==="SNIPER";

    return {
        fov:isADS?
            weapon.adsFOV:
            weapon.normalFOV,
        scopeOverlay:scoped,
        crosshair:!scoped,
        gunModel:!scoped
    };

}

function adsStatusText(
    weaponName,
    isADS
){

    if(!isADS){

        return "HIP FIRE";

    }

    return weaponName==="SNIPER"?
        "SCOPED • 1 SHOT":
        "IRON SIGHTS / ADS";

}

return {
    createWeapons:createWeapons,
    MAX_UPGRADES:MAX_UPGRADES,
    upgradeTypes:upgradeTypes,
    applyUpgrades:applyUpgrades,
    circleIntersectsWall:circleIntersectsWall,
    moveWithCollision:moveWithCollision,
    randomAirdropPosition:randomAirdropPosition,
    waveEnemyCount:waveEnemyCount,
    waveBonus:waveBonus,
    killScore:killScore,
    reloadWeapon:reloadWeapon,
    canFire:canFire,
    AIRDROP_SCORE:AIRDROP_SCORE,
    airdropHealth:airdropHealth,
    restockReserves:restockReserves,
    applyDamage:applyDamage,
    adsView:adsView,
    adsStatusText:adsStatusText
};

    }
);
