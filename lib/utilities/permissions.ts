import { PermissionFlagsBits } from "@discordjs/core";
import { BitField } from "@sapphire/bitfield";

const PermissionsBitField = new BitField(PermissionFlagsBits);

export default PermissionsBitField;
