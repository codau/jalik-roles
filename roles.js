/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 Karl STEIN
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */

/**
 * The Roles collection
 * @type {Mongo.Collection}
 */
Meteor.roles = new Mongo.Collection('jalik-roles');


Roles = {
    /**
     * Throws an error if the role does not have the permissions
     * @param perms
     * @param roleId
     */
    checkRolePerms: function (perms, roleId) {
        if (!this.roleCan(perms, roleId)) {
            throw new Meteor.Error('forbidden');
        }
    },

    /**
     * Throws an error if the user does not have the permissions
     * @param perms
     * @param userId
     */
    checkUserPerms: function (perms, userId) {
        if (!this.userCan(perms, userId)) {
            throw new Meteor.Error('forbidden');
        }
    },

    /**
     * Returns the user's role
     * @param userId
     */
    getUserRole: function (userId) {
        var user = Meteor.users.find(userId, {
            fields: {roleId: 1}
        });
        return user ? user.roleId : null;
    },

    /**
     * Checks if the role has a permission
     * @param perms
     * @param roleId
     * @return {boolean}
     */
    roleCan: function (perms, roleId) {
        if (typeof perms === 'string') {
            return Meteor.roles.find({_id: roleId, permissions: perms}).count() > 0;

        } else if (perms instanceof Array) {
            return Meteor.roles.find({_id: roleId, permissions: {$all: perms}}).count() > 0;
        }
        return false;
    },

    /**
     * Sets the user's role
     * @param userId
     * @param roleId
     */
    setUserRole: function (userId, roleId) {
        // Check if role exists
        if (roleId && Meteor.roles.find({_id: roleId}).count() < 1) {
            throw new Meteor.Error('role-not-found', "The role does not exist");
        }
        return Meteor.users.update(userId, {
            $set: {roleId: roleId}
        });
    },

    /**
     * Checks if the user has the permission
     * @param perms
     * @param userId
     * @return {boolean}
     */
    userCan: function (perms, userId) {
        // Check if actions is a string or array
        if (typeof perms === 'string') {
            perms = [perms];

        } else if (!(perms instanceof Array)) {
            throw new Meteor.Error('invalid-permissions', "Permissions must be an Array of strings");
        }

        // Nothing to verify
        if (perms.length === 0) {
            return true;
        }

        var roleId;

        // Get role id
        if (Meteor.isClient) {
            roleId = Meteor.roleId();

        } else if (Meteor.isServer) {
            if (typeof userId !== 'string' || userId.length < 1) {
                return false;
            }
            var user = Meteor.users.findOne(userId);
            roleId = user && user.roleId;
        }
        return this.roleCan(perms, roleId);
    }
};

if (Meteor.isClient) {
    /**
     * Returns the role of the current user
     * @return {any}
     */
    Meteor.role = function () {
        var user = Meteor.user();

        if (user) {
            var role = Meteor.roles.findOne(user.roleId);
            return role !== undefined ? role : null;
        }
        return null;
    };

    /**
     * Returns the role Id of the current user
     * @return {any}
     */
    Meteor.roleId = function () {
        var role = Meteor.role();
        return role ? role._id : null;
    };

    /**
     * Subscribes to role when user is modified (potentially his role)
     */
    Tracker.autorun(function () {
        if (Meteor.user() && Meteor.user()._id) {
            Meteor.subscribe('userRole');
        }
    });

    /**
     * Checks if the current user has the permission
     */
    Template.registerHelper('userCan', function (perms) {
        return Roles.userCan(perms);
    });
}

if (Meteor.isServer) {
    /**
     * Publish the role
     */
    Meteor.publish('role', function (roleId) {
        check(roleId, String);
        return Meteor.roles.find({_id: roleId});
    });

    /**
     * Publish the roles
     */
    Meteor.publish('roles', function () {
        return Meteor.roles.find();
    });

    /**
     * Publish the role of the current user
     */
    Meteor.publish('userRole', function () {
        if (!this.userId) {
            return this.ready();
        }
        var user = Meteor.users.findOne(this.userId, {
            fields: {roleId: 1}
        });

        if (user) {
            return [
                Meteor.roles.find({_id: user.roleId}),
                Meteor.users.find({_id: this.userId}, {
                    fields: {roleId: 1}
                })
            ];
        }
    });
}
